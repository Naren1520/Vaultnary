# TLS Termination

Vaultnary expects TLS to be terminated by a reverse proxy in front of the nginx container.

## Using Caddy (recommended)

```
example.com {
    reverse_proxy localhost:80
}
```

Caddy automatically provisions and renews Let's Encrypt certificates.

## Using nginx with Certbot

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

Run: `certbot --nginx -d example.com`

## Environment variable

Set `APP_ENV=production` in the api container so the `Secure` cookie attribute is applied.
