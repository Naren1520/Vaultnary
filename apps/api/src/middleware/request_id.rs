use axum::{
    body::Body,
    http::{HeaderName, HeaderValue, Request},
    response::Response,
};
use futures_util::future::BoxFuture;
use std::task::{Context, Poll};
use tower::{Layer, Service};
use uuid::Uuid;

static X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

/// Tower layer that attaches a UUID `X-Request-Id` header to every request
/// (if not already present) and echoes it back on every response.
#[derive(Clone, Debug)]
pub struct RequestIdLayer;

impl<S> Layer<S> for RequestIdLayer {
    type Service = RequestIdMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RequestIdMiddleware { inner }
    }
}

/// The actual Tower service that wraps the inner service.
#[derive(Clone, Debug)]
pub struct RequestIdMiddleware<S> {
    inner: S,
}

impl<S> Service<Request<Body>> for RequestIdMiddleware<S>
where
    S: Service<Request<Body>, Response = Response> + Send + Clone + 'static,
    S::Future: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: Request<Body>) -> Self::Future {
        // Use existing request ID or generate a new one.
        let request_id = req
            .headers()
            .get(&X_REQUEST_ID)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_owned())
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let id_value = HeaderValue::from_str(&request_id)
            .unwrap_or_else(|_| HeaderValue::from_static("invalid-uuid"));

        // Attach the request ID to the incoming request headers.
        req.headers_mut()
            .insert(X_REQUEST_ID.clone(), id_value.clone());

        let mut inner = self.inner.clone();
        Box::pin(async move {
            let mut response = inner.call(req).await?;
            // Echo the same ID on the response.
            response
                .headers_mut()
                .insert(X_REQUEST_ID.clone(), id_value);
            Ok(response)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use std::future::Ready;
    use std::task::{Context as TaskCtx, Poll};
    use tower::ServiceExt; // provides .oneshot()

    /// A minimal Clone+Send service that always returns 200 OK.
    #[derive(Clone)]
    struct OkService;

    impl Service<Request<Body>> for OkService {
        type Response = Response;
        type Error = std::convert::Infallible;
        type Future = Ready<Result<Response, std::convert::Infallible>>;

        fn poll_ready(&mut self, _cx: &mut TaskCtx<'_>) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }

        fn call(&mut self, _req: Request<Body>) -> Self::Future {
            std::future::ready(Ok(Response::new(Body::empty())))
        }
    }

    #[tokio::test]
    async fn attaches_new_request_id_when_absent() {
        let svc = RequestIdLayer.layer(OkService);
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();
        let resp = svc.oneshot(req).await.unwrap();
        assert!(resp.headers().contains_key("x-request-id"));
    }

    #[tokio::test]
    async fn preserves_existing_request_id() {
        let svc = RequestIdLayer.layer(OkService);
        let req = Request::builder()
            .uri("/")
            .header("x-request-id", "my-fixed-id")
            .body(Body::empty())
            .unwrap();
        let resp = svc.oneshot(req).await.unwrap();
        assert_eq!(resp.headers().get("x-request-id").unwrap(), "my-fixed-id");
    }

    #[tokio::test]
    async fn echoes_request_id_on_response() {
        let svc = RequestIdLayer.layer(OkService);
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();
        let resp = svc.oneshot(req).await.unwrap();
        let id = resp.headers().get("x-request-id").unwrap();
        assert!(!id.is_empty());
    }
}
