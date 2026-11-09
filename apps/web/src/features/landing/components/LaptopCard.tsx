import './laptop-card.css'

export default function LaptopCard() {
  return (
    <div className="lp-laptop-card" role="img" aria-label="Vaultnary workspace shown on a laptop">
      <div className="lp-laptop-card__device">
        <div className="lp-laptop-card__screen">
          <span className="lp-laptop-card__camera" />
          <div className="lp-laptop-card__display">
            <div className="lp-laptop-card__appbar">
              <span className="lp-laptop-card__appmark">V</span>
              <span>Vaultnary</span>
              <span className="lp-laptop-card__appbar-label">TEAM WORKSPACE</span>
            </div>
            <div className="lp-laptop-card__content">
              <p>YOUR TEAM, IN SYNC</p>
              <h3>A clearer home<br />for every credential.</h3>
              <span>Keep projects, people, and access in context.</span>
              <div className="lp-laptop-card__workspace">
                <i><span /></i>
                <span><b>Product workspace</b><small>Credentials organized and ready</small></span>
                <strong>OPEN</strong>
              </div>
            </div>
            <div className="lp-laptop-card__display-footer">
              <span><i /> PRIVATE WORKSPACE</span>
              <span>Vaultnary</span>
            </div>
          </div>
        </div>
        <div className="lp-laptop-card__keyboard">
          <span className="lp-laptop-card__trackpad" />
          <span className="lp-laptop-card__foot lp-laptop-card__foot--left" />
          <span className="lp-laptop-card__foot lp-laptop-card__foot--right" />
        </div>
      </div>
    </div>
  )
}
