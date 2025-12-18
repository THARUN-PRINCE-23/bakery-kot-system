"use client";

export default function SessionExpiredPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
        <h1 className="text-2xl font-bold mb-2">Session expired</h1>
        <p className="text-sm text-gray-700">
          Your access token has expired. Please re-open the QR link to continue.
        </p>
      </div>
    </main>
  );
}
