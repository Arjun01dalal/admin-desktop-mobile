import { useState } from "react";
import "../../../../Components/CallingModal/CallingModal.css";

type ValidationItem = {
  _id: string;
  point: string;
  name: string;
  passed: boolean;
  reason?: string;
  details?: Record<string, any>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  data: ValidationItem[];
};

const modalStyle = {
  main: {
    width: "75%",
    maxHeight: "90vh",
    padding: "20px",
  },
  details: {
    width: "40%",
    maxHeight: "80vh",
    padding: "20px",
  },
};

const ValidationModal = ({ open, onClose, data }: Props) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, any> | null>(null);

  if (!open || !data?.length) return null;

  const openDetails = (details: Record<string, any>) => {
    setSelectedDetails(details);
    setDetailsOpen(true);
  };

  return (
    <>
      {/* MAIN MODAL */}
      <div className="callingOverlay flex justify-center items-center p-4">
        <div className="callingModal bg-white rounded-xl shadow-lg overflow-auto" style={modalStyle.main}>
          <Header title="Validation Results" onClose={onClose} />

          <table className="border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Point</th>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Reason</th>
                <th className="p-2 border">Other Details</th>
              </tr>
            </thead>

            <tbody>
              {data.map((v) => (
                <tr key={v._id}>
                  <td className="p-2 border text-center">{v.point}</td>

                  <td className="p-2 border">{v.name}</td>

                  <td
                    className="p-2 border font-bold"
                    style={{ color: v.passed ? "green" : "red" }}
                  >
                    {v.passed ? "Passed" : "Failed"}
                  </td>

                  <td className="p-2 border">{v.reason || "-"}</td>

                  <td className="p-2 border">
                    <button
                      onClick={() => openDetails(v.details || {})}
                      className="px-3 py-1 rounded"
                      style={{ backgroundColor: "orange" }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILS MODAL */}
      {detailsOpen && (
        <div className="callingOverlay flex justify-center items-center p-4">
          <div className="callingModal bg-white rounded-xl shadow-lg" style={modalStyle.details}>
            <Header title="Other Details" onClose={() => setDetailsOpen(false)} />

            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <DetailsRenderer details={selectedDetails} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ValidationModal;





/* ---------- Sub Components ---------- */

const Header = ({ title, onClose }: { title: string; onClose: () => void }) => (
  <div className="flex flex-row justify-between mb-3">
    <h4 className="font-semibold">{title}</h4>
    <button
      onClick={onClose}
      className="px-3 py-1 rounded text-white"
      style={{ backgroundColor: "red" }}
    >
      Close
    </button>
  </div>
);

const DetailsRenderer = ({ details }: { details: Record<string, any> | null }) => {
  if (!details) return <p>No Details</p>;

  return (
    <>
      {Object.entries(details).map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <div key={key} className="mb-4">
              <b>{key}:</b>

              {value.length === 0 ? (
                <div>-</div>
              ) : (
                value.map((item, index) => (
                  <div key={index} className="border p-2 mt-2 rounded">
                    {Object.entries(item).map(([k, v]) => (
                      <NestedValue key={k} label={k} value={v} />
                    ))}
                  </div>
                ))
              )}
            </div>
          );
        }

        return (
          <div key={key} className="mb-1">
            <b>{key}:</b> {String(value)}
          </div>
        );
      })}
    </>
  );
};

const NestedValue = ({ label, value }: { label: string; value: any }) => {
  if (Array.isArray(value)) {
    return (
      <div className="mt-2">
        <b>{label}:</b>
        {value.map((rec: any, i: number) => (
          <div key={i} className="ml-3 mt-1 p-2 border border-dashed">
            {Object.entries(rec).map(([rk, rv]) => (
              <div key={rk}>
                <b>{rk}:</b> {String(rv)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <b>{label}:</b> {String(value)}
    </div>
  );
};
