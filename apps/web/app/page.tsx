import Dashboard from '../components/dashboard';
import { hostedReadiness, isHosted } from '../../../packages/deployment/config';
export const dynamic = 'force-dynamic';
export default function Page() {
  const state = hostedReadiness();
  if (!state.ready)
    return (
      <main className="auth-page">
        <section className="auth-story">
          <div className="wordmark">AFTER ACTION REPORT</div>
          <p className="eyebrow">YOUR PRIVATE CAMPAIGN WORKSPACE</p>
          <h1>
            Your chronicle
            <br />
            <em>is almost ready.</em>
          </h1>
          <p>
            The website is deployed. Its owner needs to finish connecting the private services
            before anyone can sign in.
          </p>
        </section>
        <section className="auth-form">
          <h2>Finish your private setup</h2>
          <p>In your Vercel project, connect the items below, then redeploy.</p>
          <ol>
            {state.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <p>Database: Vercel project → Storage → connect a Neon PostgreSQL database.</p>
          <p>
            Files: Storage → create a Blob store and choose <strong>Private</strong> access.
          </p>
          <p>
            Account access: Settings → Environment Variables → add{' '}
            <code>AAR_REGISTRATION_CODE</code>. Choose a private phrase at least 24 characters long;
            share it only with your group.
          </p>
          <p>
            Your owner can follow <code>docs/VERCEL_SETUP.md</code> in the GitHub repository. No
            demo accounts are created on this site.
          </p>
        </section>
      </main>
    );
  return <Dashboard hosted={isHosted()} />;
}
