import { useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  Layers3,
  RotateCcw,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react'
import './App.css'

type HealthState = 'attention' | 'operational'

const commitSha = import.meta.env.VITE_COMMIT_SHA?.trim() ?? ''
const isDeployedBuild = /^[0-9a-f]{40}$/i.test(commitSha)
const imageName = import.meta.env.VITE_IMAGE_NAME?.trim() || 'ghcr.io/OWNER/gitops-learning-demo'
const shortVersion = isDeployedBuild ? commitSha.slice(0, 7) : 'local preview'

function App() {
  const [health, setHealth] = useState<HealthState>('attention')
  const [lastCheck, setLastCheck] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('A simulated incident is ready for the exercise.')

  function runHealthCheck() {
    setLastCheck(new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()))
    setFeedback(
      health === 'operational'
        ? 'All 3 simulated checks passed. The service is operational.'
        : '2 of 3 simulated checks passed. Try the recovery control.',
    )
  }

  function simulateRecovery() {
    setHealth('operational')
    setLastCheck(new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()))
    setFeedback('Simulated recovery complete. No Kubernetes resources were changed.')
  }

  const pipelineSteps = [
    { label: 'Source', detail: isDeployedBuild ? 'Commit embedded' : 'Workspace', state: isDeployedBuild ? 'complete' : 'current' },
    { label: 'Build', detail: isDeployedBuild ? 'Static assets' : 'Local preview', state: isDeployedBuild ? 'complete' : 'current' },
    { label: 'Publish', detail: 'Image reference', state: 'pending' },
    { label: 'Sync', detail: 'View in Argo CD', state: 'pending' },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Relay dashboard home">
          <span className="brand-mark"><GitBranch size={19} strokeWidth={2.4} /></span>
          <span className="brand-copy"><strong>relay</strong><small>release console</small></span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><Layers3 size={17} />Overview</a>
          <a className="nav-item" href="#release-path"><Workflow size={17} />Release path</a>
          <a className="nav-item" href="#health"><Activity size={17} />Service health</a>
        </nav>

        <div className="sidebar-spacer" />

        <section className="cluster-card" aria-label="Local deployment target">
          <div className="cluster-card-heading"><span className="status-dot" />LOCAL TARGET</div>
          <strong>docker-desktop</strong>
          <span>Kubernetes target</span>
          <div className="cluster-footer"><span><HardDrive size={14} />Static app</span><span>Git managed</span></div>
        </section>

        <div className="sidebar-footnote"><span className="mode-square" />Learning environment</div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspaces</span><span className="crumb-slash">/</span><strong>GitOps demo</strong></div>
          <div className="topbar-right">
            <span className="connection-pill"><span className="status-dot" />Local demo</span>
            <span className="avatar" aria-label="Demo workspace">D</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">RELEASE OPERATIONS <span className="eyebrow-divider">/</span> LOCAL</p>
              <h1>GitOps release dashboard</h1>
              <p className="page-subtitle">A clear view from the commit to the cluster.</p>
            </div>
            <a className="external-link" href="https://localhost:8080" target="_blank" rel="noreferrer">
              <span>Open Argo CD</span><ArrowUpRight size={16} />
            </a>
          </section>

          <section className="hero-band" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="demo-tag"><span className="demo-tag-dot" />GITOPS LEARNING DEMO</div>
              <h2 id="hero-title">One change.<br /><span>All the way live.</span></h2>
              <p>Push a change to GitHub and follow it through build, image publish, and automatic cluster sync.</p>
              <div className="hero-bottom">
                <span className="hero-caption"><Zap size={14} /> GITOPS WORKFLOW</span>
                <span className="hero-caption-divider" />
                <span className="hero-caption">LOCAL · DOCKER DESKTOP</span>
              </div>
            </div>
            <div className="hero-graphic" aria-hidden="true">
              <div className="graphic-grid" />
              <div className="graphic-line line-one" />
              <div className="graphic-line line-two" />
              <div className="graphic-node node-source"><GitBranch size={18} /><span>GIT</span></div>
              <div className="graphic-node node-build"><Workflow size={18} /><span>BUILD</span></div>
              <div className="graphic-node node-sync"><Layers3 size={18} /><span>SYNC</span></div>
              <div className="graphic-pulse" />
              <div className="graphic-label">CONTINUOUS DELIVERY <span>01 — 04</span></div>
            </div>
          </section>

          <section className="release-overview" id="release-path" aria-labelledby="release-title">
            <div className="section-heading">
              <div><span className="section-kicker">BUILD METADATA</span><h2 id="release-title">Release path</h2></div>
              <span className={isDeployedBuild ? 'release-state synced' : 'release-state preview'}>
                <span className="status-dot" />{isDeployedBuild ? 'Versioned build' : 'Local preview'}
              </span>
            </div>

            <div className="pipeline" role="list" aria-label="Release pipeline steps">
              {pipelineSteps.map((step, index) => (
                <div className="pipeline-step-wrap" key={step.label}>
                  <div className={`pipeline-step ${step.state}`} role="listitem">
                    <span className="step-icon">
                      {step.state === 'complete' ? <Check size={16} /> : step.state === 'current' ? <GitCommitHorizontal size={17} /> : <Circle size={16} />}
                    </span>
                    <span className="step-copy"><strong>{step.label}</strong><small>{step.detail}</small></span>
                  </div>
                  {index < pipelineSteps.length - 1 && <span className={`pipeline-connector ${step.state === 'complete' ? 'done' : ''}`} />}
                </div>
              ))}
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="release-panel" aria-labelledby="current-release-title">
              <div className="panel-heading">
                <div><span className="section-kicker">RUNNING BUILD</span><h2 id="current-release-title">Current release</h2></div>
                <span className="panel-icon mint"><GitCommitHorizontal size={18} /></span>
              </div>
              <div className="release-version-row">
                <code className="version-badge">{shortVersion}</code>
                <span className={isDeployedBuild ? 'version-state live' : 'version-state local'}>
                  <span className="status-dot" />{isDeployedBuild ? 'Build metadata' : 'Workspace build'}
                </span>
              </div>
              <div className="release-details">
                <div className="detail-row"><span>Image</span><code className="image-reference">{isDeployedBuild ? `${imageName}:${commitSha}` : `${imageName}:<commit-sha>`}</code></div>
                <div className="detail-row"><span>Namespace</span><code>gitops-demo</code></div>
                <div className="detail-row"><span>Last health check</span><span className="detail-value">{lastCheck ?? 'Not run yet'}</span></div>
              </div>
              <div className="release-note"><Clock3 size={15} /><span>{isDeployedBuild ? 'Version is read from this image build.' : 'A real commit version appears after the first GitHub Actions release.'}</span></div>
            </section>

            <section className="health-panel" id="health" aria-labelledby="health-title">
              <div className="panel-heading">
                <div><span className="section-kicker">INTERACTIVE EXERCISE</span><h2 id="health-title">Service health</h2></div>
                <span className="panel-icon orange"><ShieldCheck size={18} /></span>
              </div>
              <div className={`health-status ${health}`}>
                <span className="health-symbol">{health === 'operational' ? <CheckCircle2 size={21} /> : <Activity size={21} />}</span>
                <div><strong>{health === 'operational' ? 'Operational' : 'Attention needed'}</strong><small>Simulated exercise state</small></div>
                <span className="health-label">{health === 'operational' ? 'HEALTHY' : 'DEGRADED'}</span>
              </div>
              <div className="health-checks">
                <div className="check-row"><span className="check-name"><span className="check-indicator pass" /><span>Dashboard responds</span></span><span>OK</span></div>
                <div className="check-row"><span className="check-name"><span className="check-indicator pass" /><span>Release version loaded</span></span><span>OK</span></div>
                <div className="check-row"><span className="check-name"><span className={`check-indicator ${health === 'operational' ? 'pass' : 'warn'}`} /><span>Service status</span></span><span>{health === 'operational' ? 'OK' : 'SIMULATED'}</span></div>
              </div>
              <div className="health-actions">
                <button className="button-secondary" type="button" onClick={runHealthCheck}><Activity size={16} />Run health check</button>
                <button className="button-primary" type="button" onClick={simulateRecovery}><RotateCcw size={16} />Simulate recovery</button>
              </div>
              <p className="simulation-note" role="status" aria-live="polite">{feedback}</p>
              <div className="simulation-guard"><ShieldCheck size={14} /><span>Buttons simulate UI state only. Git changes drive deployment.</span></div>
            </section>
          </div>

          <footer className="page-footer">
            <span><span className="status-dot" />Docker Desktop · local target</span>
            <span>Deployment status <span className="footer-divider">·</span> <a href="https://localhost:8080" target="_blank" rel="noreferrer">View in Argo CD <ArrowUpRight size={13} /></a></span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App