export default function HelpGuide() {
  return (
    <div className="modal-body help-body">
      <span className="outline-chip">FEATURES 1–3</span>
      <h3>A complete relationship, in a few minutes.</h3>
      <ol>
        <li>
          Sign in as <strong>Rachel Tan</strong> with demo MFA code <strong>123456</strong>.
        </li>
        <li>Add a client, complete the guided form, and simulate identity verification.</li>
        <li>Open the client’s Accounts tab and create an SGD account.</li>
        <li>
          Go to Transactions and run a simulated import. Try each scenario and repeat one to see
          duplicate handling.
        </li>
        <li>
          Sign out using the sidebar icon. Sign in as <strong>Alex Morgan</strong> to manage users
          and review audit records.
        </li>
        <li>Use User management → Reset demo data to start fresh.</li>
      </ol>
      <p className="notice">
        All data is fictional and saved only in this browser. Authentication, identity review,
        imports, and audit logging are simulations. No documents, passwords, messages, or transfers
        leave this frontend.
      </p>
    </div>
  );
}
