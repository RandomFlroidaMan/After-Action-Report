'use client';
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main className="login">
      <h1>The chronicle hit a snag.</h1>
      <p>Your saved campaign data remains in the database.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
