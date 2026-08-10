import React, { useState } from "react";
import "../../../../Css/style.css";
import "../../../../Css/table.css";
import "../../../../Css/users.css";
import "./Withdrawal.css";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../../../../Components/Loader/Loader";
import { API_Endpoint } from "../../../../Configuration/Settings";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import { API_Handler } from "../../../../API/API_Handler";
import * as XLSX from "xlsx";
import { dateTime } from "../../../../utils/utility";

function CheckWithdraw() {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any>([]);
  const [ocrdata, setOCRData] = useState<any>([]);
  const [id, setId] = useState(0);
  const [startDate, setStartDate] = useState<string>(
    dateTime(
      new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    )
  );
  const [endDate, setEndDate] = useState<string>(
    dateTime(
      new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    )
  );

  console.log("edwe::", startDate, endDate);

  const extractPaymentDetails = (row: any) => {
    const details: any = {};

    // 1. Status
    for (const key in row) {
      if (/success/i.test(key) || /success/i.test(String(row[key]))) {
        console.log("row[key]:::", row[key]);

        details.status = String(
          row[key] === "Transfer Successful" ? "Success" : row[key]
        );
        break;
      }
    }

    // 3. Payment Time
    const datetimePatterns = [
      /\d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2}/,
      /\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2} (AM|PM)?/,
      /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    ];
    for (const key in row) {
      const value = row[key];
      if (typeof value === "string") {
        for (const pattern of datetimePatterns) {
          if (pattern.test(value)) {
            details["Payment Time"] = value;
            break;
          }
        }
        if (details["Payment Time"]) break;
      }
    }

    const amountKey = Object.keys(row).find((k) =>
      /^(Amount|TotAmount|__EMPTY_4)$/i.test(k)
    );
    if (amountKey) {
      details.Amount =
        typeof row[amountKey] === "number"
          ? row[amountKey]
          : Number(row[amountKey]?.replace("₹", ""));
    } else {
      // fallback to numeric value > 0
      for (const key in row) {
        const value = row[key];
        console.log("value::", value, typeof value);

        if (typeof value === "number" && value > 0) {
          details.Amount = value;
          break;
        }
        if (typeof value === "string" && /₹\d+/.test(value)) {
          details.Amount = Number(value?.replace("₹", ""));
          break;
        }
      }
    }

    // 🟢 ACCOUNT NUMBER
    const accountKey = Object.keys(row).find((k) =>
      /(Ac.?No|Account.?No|Acc.?Number|AccountNumber)/i.test(k)
    );
    if (accountKey) {
      details["Ac No"] = String(row[accountKey]);
    } else {
      // fallback numeric detection
      for (const key in row) {
        const value = row[key];
        if (typeof value === "number" && String(value).length >= 9) {
          details["Ac No"] = String(value);
          break;
        }
      }
    }

    // 5. IFSC
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    for (const key in row) {
      const value = row[key];
      if (typeof value === "string" && ifscPattern.test(value)) {
        details.IFSC = value;
        break;
      }
    }

    return details;
  };

  //   const handleFileUpload = (e: any) => {
  //     const files = Array.from(e.target.files);
  //     if (!files.length) return;

  //     const allDetails: any[] = [];

  //     // files.forEach((file: any) => {
  //     //   if (!file) return;

  //     //   const reader = new FileReader();
  //     //   reader.onload = (event: any) => {
  //     //     const data = event.target.result;
  //     //     const workbook = XLSX.read(data, { type: "binary" });
  //     //     const sheetName = workbook.SheetNames[0];
  //     //     const sheet = workbook.Sheets[sheetName];

  //     //     let json: any = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  //     //     let normalizedRows: any[] = [];

  //     //     if (!Array.isArray(json)) json = [json];

  //     //     if (
  //     //       json.length === 1 &&
  //     //       Object.keys(json[0]).some((k) => /^\d+(\.\d+)?$/.test(k))
  //     //     ) {
  //     //       const row = json[0];
  //     //       for (const key in row) {
  //     //         const value = row[key];
  //     //         if (typeof value === "number") {
  //     //           normalizedRows.push({ [key]: value, ...row });
  //     //         }
  //     //       }
  //     //     } else {
  //     //       normalizedRows = json;
  //     //     }

  //     //     const detailsArray = normalizedRows.map((row) =>
  //     //       extractPaymentDetails(row)
  //     //     );
  //     //     validateWithdrawal(detailsArray);
  //     //     console.log("Extracted Payment Details:", detailsArray);
  //     //   };

  //     //   reader.readAsBinaryString(file);
  //     // });

  //     // Helper to read a file as Promise
  //     const readFileAsJSON = async (file: any) => {
  //       return new Promise((resolve, reject) => {
  //         const reader = new FileReader();

  //         reader.onload = (event: any) => {
  //           try {
  //             const data = event.target.result;
  //             const workbook = XLSX.read(data, { type: "binary" });
  //             const sheetName = workbook.SheetNames[0];
  //             const sheet = workbook.Sheets[sheetName];

  //             let json: any = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  //             if (!Array.isArray(json)) json = [json];

  //             let normalizedRows: any[] = [];

  //             // Handle single numeric-key rows
  //             if (
  //               json.length === 1 &&
  //               Object.keys(json[0]).some((k) => /^\d+(\.\d+)?$/.test(k))
  //             ) {
  //               const row = json[0];
  //               for (const key in row) {
  //                 const value = row[key];
  //                 if (typeof value === "number") {
  //                   normalizedRows.push({ [key]: value, ...row });
  //                 }
  //               }
  //             } else {
  //               normalizedRows = json;
  //             }

  //             const detailsArray = normalizedRows.map((row) =>
  //               extractPaymentDetails(row)
  //             );

  //             resolve(detailsArray);
  //           } catch (error) {
  //             reject(error);
  //           }
  //         };

  //         reader.onerror = reject;
  //         reader.readAsBinaryString(file);
  //       });

  //     // Read all files in parallel
  //     try {
  //       const results = await Promise.all(files.map(readFileAsJSON));

  //       // Flatten all details from all files
  //       const mergedDetails = results.flat();

  //       console.log("✅ All files processed. Extracted details:", mergedDetails);

  //       // 👇 Now call your API once after all files are read
  //       validateWithdrawal(mergedDetails);
  //     } catch (error) {
  //       console.error("❌ Error reading files:", error);
  //     }
  //   };

  const handleFileUpload = async (e: any) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const allDetails: any[] = [];

    // Helper to read a file as Promise
    const readFileAsJSON = (file: any) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event: any) => {
          try {
            const data = event.target.result;
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            let json: any = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            if (!Array.isArray(json)) json = [json];

            let normalizedRows: any[] = [];

            // Handle single numeric-key rows
            if (
              json.length === 1 &&
              Object.keys(json[0]).some((k) => /^\d+(\.\d+)?$/.test(k))
            ) {
              const row = json[0];
              for (const key in row) {
                const value = row[key];
                if (typeof value === "number") {
                  normalizedRows.push({ [key]: value, ...row });
                }
              }
            } else {
              normalizedRows = json;
            }

            const detailsArray = normalizedRows.map((row) =>
              extractPaymentDetails(row)
            );

            resolve(detailsArray);
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = reject;
        reader.readAsBinaryString(file);
      });
    };

    // Read all files in parallel
    try {
      const results = await Promise.all(files.map(readFileAsJSON));

      // Flatten all details from all files
      const mergedDetails = results.flat();

      console.log("✅ All files processed. Extracted details:", mergedDetails);
      setOCRData(mergedDetails);
      // 👇 Now call your API once after all files are read
    } catch (error) {
      console.error("❌ Error reading files:", error);
    }
  };

  const handleValidate = () => {
    validateWithdrawal(ocrdata);
  };

  const validateWithdrawal = async (val: any) => {
    try {
      setLoading(true);
      let token = localStorage.getItem("token");
      const response = await API_Handler.post(
        `${API_Endpoint}/change-percentage/create-withdrawalSheet`,
        { withdrawalSheet: val, startDate: startDate, endDate: endDate },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            maxBodyLength: Infinity,
          },
        }
      );

      if (response.data?.success) {
        const ids = response?.data?.data?.payload || {};
        console.log("response.data::::", ids);
        setData(ids);
      }
    } catch (error) {
      console.error("Error validateWithdrawal:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // <>
    //   {loading ? (
    //     <Loader />
    //   ) : (
    //     <div className="g-sidenav-show  bg-gray-100">
    //       <ToastContainer autoClose={2000} position="top-center" />
    //       <Sidenav />
    //       <main className="main-content position-relative">
    //         <div style={{ background: "#f8f9fa" }}>
    //           <Breadcrumbs tab={"Check Withdrawal"} />
    //         </div>
    //         <div className="row">
    //           <div className="row tp-form mb-2">
    //             <div className="col-6 col-xl-2 col-sm-4 pdrt">
    //               <label className="lbl">From Date</label>
    //               <input
    //                 type="date"
    //                 className="form-control"
    //                 placeholder="From Date"
    //                 // value={startDate}
    //                 // onChange={(e) => setStartDate(e.target.value)}
    //               />
    //             </div>
    //             <div className="col-6 col-xl-2 col-sm-4 pdrt">
    //               <label className="lbl">To Date</label>
    //               <input
    //                 type="date"
    //                 className="form-control"
    //                 placeholder="To Date"
    //                 //  value={endDate}
    //                 //onChange={(e) => setEndDate(e.target.value)}
    //               />
    //             </div>
    //           </div>
    //         </div>
    //         <div className="w-full sm:w-1/2 lg:w-1/4 xl:w-1/6 mt-2 px-2">
    //           <div className="text-sm font-medium mb-2">Upload Excel File</div>
    //           <input
    //             type="file"
    //             accept=".xlsx, .xls, .csv"
    //             multiple
    //             onChange={handleFileUpload}
    //             className="w-full cursor-pointer border border-gray-300 text-sm rounded-lg p-2 hover:border-blue-500 focus:outline-none focus:ring focus:ring-blue-200"
    //           />
    //         </div>

    //         {/* Card 1 */}

    //         <div className="row m-0 mt-4">
    //           <div className="col-md-6 mb-6" onClick={() => setId(0)}>
    //             <div
    //               className="card card-dashboard"
    //               style={{ paddingRight: 10, paddingLeft: 10 }}
    //             >
    //               <div className="card-body p-3 pl-0">
    //                 <h4 className="font-weight-bolder">Data Sheet Record:</h4>
    //               </div>
    //               <h6 className="mb-1 pt-2 text-bold">
    //                 Total Count:
    //                 <span className="betamount">
    //                   {data?.totalAmountMismatchPlatform?.totalCount ?? 0}
    //                 </span>
    //               </h6>
    //               <h6 className="mb-1 pt-2 text-bold">
    //                 Total Amount:
    //                 <span className="betamount">
    //                   {data?.totalAmountMismatchPlatform?.totalAmount ?? 0}
    //                 </span>
    //               </h6>
    //             </div>
    //           </div>
    //           <div className="col-md-6 mb-6" onClick={() => setId(1)}>
    //             <div
    //               className="card card-dashboard"
    //               style={{ paddingRight: 10, paddingLeft: 10 }}
    //             >
    //               <div className="card-body p-3">
    //                 <h4 className="font-weight-bolder">DB Record Details:</h4>
    //               </div>
    //               <h6 className="mb-1 pt-2 text-bold">
    //                 Total Count:
    //                 <span className="betamount">
    //                   {data?.totalAmountMismatchDataSheet?.totalCount ?? 0}
    //                 </span>
    //               </h6>
    //               <h6 className="mb-1 pt-2 text-bold">
    //                 Total Amount:
    //                 <span className="betamount">
    //                   {data?.totalAmountMismatchDataSheet?.totalAmount ?? 0}
    //                 </span>
    //               </h6>
    //             </div>
    //           </div>
    //         </div>
    //         {id === 0 ? (
    //           <table className="table table-view">
    //             <thead>
    //               <tr>
    //                 <th>
    //                   SR
    //                   <br /> No
    //                 </th>
    //                 <th>Ac. No</th>
    //                 <th>Amount</th>
    //                 <th>ISFC</th>
    //                 <th>Payment Time</th>
    //                 <th>Status</th>
    //               </tr>
    //             </thead>
    //             <tbody>
    //               {data?.totalAmountMismatchPlatform?.documents?.map(
    //                 (item: any, index: number) => {
    //                   return (
    //                     <tr>
    //                       <td>{index + 1}</td>
    //                       <td>{item?.frontend?.["Ac No"]}</td>
    //                       <td>{item?.frontend?.["Amount"]}</td>
    //                       <td>{item?.frontend?.["IFSC"]}</td>
    //                       <td>{item?.frontend?.["Payment Time"]}</td>
    //                       <td>{item?.frontend?.["status"]}</td>
    //                     </tr>
    //                   );
    //                 }
    //               )}
    //             </tbody>
    //           </table>
    //         ) : (
    //           <table className="table table-view">
    //             <thead>
    //               <tr>
    //                 <th>
    //                   SR
    //                   <br /> No
    //                 </th>
    //                 <th>amount</th>
    //                 <th>mid</th>
    //                 <th>mobile</th>
    //                 <th>orderId</th>
    //                 <th>status</th>
    //                 <th>updatedOn</th>
    //               </tr>
    //             </thead>
    //             <tbody>
    //               {data?.totalAmountMismatchDataSheet?.documents?.map(
    //                 (item: any, index: number) => {
    //                   return (
    //                     <tr>
    //                       <td>{index + 1}</td>
    //                       <td>{item?.backend?.["amount"]}</td>
    //                       <td>{item?.backend?.["mid"]}</td>
    //                       <td>{item?.backend?.["mobile"]}</td>
    //                       <td>{item?.backend?.["orderId"]}</td>
    //                       <td>{item?.backend?.["status"]}</td>
    //                       <td>{item?.backend?.["updatedOn"]}</td>
    //                     </tr>
    //                   );
    //                 }
    //               )}
    //             </tbody>
    //           </table>
    //         )}
    //       </main>
    //     </div>
    //   )}
    // </>

    <>
      {/* {loading ? (
        <Loader />
      ) : ( */}
      <div className="g-sidenav-show bg-gray-100">
        <ToastContainer autoClose={2000} position="top-center" />
        <Sidenav />

        <main className="main-content position-relative">
          <div style={{ background: "#f8f9fa" }}>
            <Breadcrumbs tab={"Check Withdrawal"} />
          </div>

          {/* Filter Section */}
          <div className="row align-items-end px-3 mt-3">
            <div className="col-12 col-sm-6 col-md-4 col-xl-2 mb-3">
              <label className="lbl">From Date</label>
              <input
                type="date"
                className="form-control"
                placeholder="From Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="col-12 col-sm-6 col-md-4 col-xl-2 mb-3">
              <label className="lbl">To Date</label>
              <input
                type="date"
                className="form-control"
                placeholder="To Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="col-12 col-sm-6 col-md-4 col-xl-3 mb-3">
              <label className="lbl">Upload Excel File</label>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                multiple
                onChange={handleFileUpload}
                className="form-control"
              />
            </div>
            {/* Validate Button */}
            <div className="col-12 col-sm-6 col-md-4 col-xl-2 d-flex align-items-end">
              {loading ? (
                <button
                  className="btn btn-secondary w-100 d-flex justify-content-center align-items-center"
                  disabled
                >
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Validating...
                </button>
              ) : (
                <button
                  className="btn w-100"
                  style={{ backgroundColor: "#F1A143", color: "#000" }}
                  onClick={handleValidate}
                  disabled={!startDate || !endDate}
                >
                  Validate
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="row m-0 mt-4">
            <div className="col-12 col-md-6 mb-3" onClick={() => setId(0)}>
              <div className="card card-dashboard" style={{ padding: "10px" }}>
                <div className="card-body p-3">
                  <h4 className="font-weight-bolder">Data Sheet Record:</h4>
                </div>
                <h6 className="mb-1 pt-2 text-bold">
                  Total Count:{" "}
                  <span className="betamount">
                    {data?.totalAmountMismatchPlatform?.totalCount ?? 0}
                  </span>
                </h6>
                <h6 className="mb-1 pt-2 text-bold">
                  Total Amount:{" "}
                  <span className="betamount">
                    {data?.totalAmountMismatchPlatform?.totalAmount ?? 0}
                  </span>
                </h6>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3" onClick={() => setId(1)}>
              <div className="card card-dashboard" style={{ padding: "10px" }}>
                <div className="card-body p-3">
                  <h4 className="font-weight-bolder">DB Record Details:</h4>
                </div>
                <h6 className="mb-1 pt-2 text-bold">
                  Total Count:{" "}
                  <span className="betamount">
                    {data?.totalAmountMismatchDataSheet?.totalCount ?? 0}
                  </span>
                </h6>
                <h6 className="mb-1 pt-2 text-bold">
                  Total Amount:{" "}
                  <span className="betamount">
                    {data?.totalAmountMismatchDataSheet?.totalAmount ?? 0}
                  </span>
                </h6>
              </div>
            </div>
          </div>

          {/* Responsive Table */}
          <div className="table-responsive mt-4 px-3">
            {id === 0 ? (
              <table className="table table-view table-bordered table-striped">
                <thead
                //  className="table-light"
                //style={{ backgroundColor: "#007bff", color: "white" }}
                >
                  <tr>
                    <th>
                      SR
                      <br />
                      No
                    </th>
                    <th>Ac. No</th>
                    <th>Amount</th>
                    <th>IFSC</th>
                    <th>Payment Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.totalAmountMismatchPlatform?.documents?.map(
                    (item: any, index: number) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{item?.frontend?.["Ac No"]}</td>
                        <td>{item?.frontend?.["Amount"]}</td>
                        <td>{item?.frontend?.["IFSC"]}</td>
                        <td>{item?.frontend?.["Payment Time"]}</td>
                        <td>{item?.frontend?.["status"]}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            ) : (
              <table className="table table-view table-bordered table-striped">
                <thead className="table-light">
                  <tr>
                    <th>
                      SR
                      <br />
                      No
                    </th>
                    <th>Amount</th>
                    <th>Mid</th>
                    <th>Mobile</th>
                    <th>Order ID</th>
                    <th>Status</th>
                    <th>Updated On</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.totalAmountMismatchDataSheet?.documents?.map(
                    (item: any, index: number) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{item?.backend?.["amount"]}</td>
                        <td>{item?.backend?.["mid"]}</td>
                        <td>{item?.backend?.["mobile"]}</td>
                        <td>{item?.backend?.["orderId"]}</td>
                        <td>{item?.backend?.["status"]}</td>
                        <td>{item?.backend?.["updatedOn"]}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
      {/* )} */}
    </>
  );
}

export default CheckWithdraw;
