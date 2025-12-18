import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">SREE KUMARAN SWEETS &amp; BAKERY</h1>
      <p className="text-gray-600 max-w-xl">
        QR ordering for customers and a live dashboard for the counter. Use the
        links below or scan a table QR that points to
        /menu?table=TABLE_NUMBER.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
        {[1,2,3,4,5,6,7,8].map((t) => (
          <Link
            key={t}
            href={`/menu?table=${t}`}
            className="rounded bg-emerald-600 px-4 py-3 text-white text-center shadow hover:shadow-md transition"
          >
            Table {t}
          </Link>
        ))}
        <Link
          href="/dashboard"
          className="rounded border border-gray-300 px-4 py-3 text-gray-700 text-center shadow-sm hover:shadow transition col-span-2 sm:col-span-4"
        >
          Counter Dashboard
        </Link>
      </div>
    </main>
  );
}
