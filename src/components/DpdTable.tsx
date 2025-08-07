const DpdBucketTable = () => {
  const buckets = [
    { min: 0, max: 0, bucket: 0 },
    { min: 1, max: 30, bucket: 1 },
    { min: 31, max: 60, bucket: 2 },
    { min: 61, max: 90, bucket: 3 },
    { min: 91, max: null, bucket: 4 },
  ];

  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-200 w-full max-w-xs p-4 mt-8">
      <table className="w-full text-xs text-gray-700 border border-gray-200">
        <thead className="bg-gray-100 text-gray-600 font-medium">
          <tr>
            <th className="px-2 py-1 border">Bucket</th>
            <th className="px-2 py-1 border">DPD Min</th>
            <th className="px-2 py-1 border">DPD Max</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map(({ min, max, bucket }) => (
            <tr
              key={bucket}
              className="text-center even:bg-gray-50 hover:bg-gray-100 transition"
            >
              <td className="px-2 py-1 border font-medium">{bucket}</td>
              <td className="px-2 py-1 border">{min}</td>
              <td className="px-2 py-1 border">{max !== null ? max : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[11px] text-gray-500 mt-3 leading-snug">
        <strong>Note:</strong> Buckets may vary depending on internal risk
        policies and discretion.
      </p>
    </div>
  );
};

export default DpdBucketTable;
