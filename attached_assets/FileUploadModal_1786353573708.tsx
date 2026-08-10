import React, { useState } from "react";
import pdfToText from "react-pdftotext";
import * as XLSX from "xlsx";

import { Modal, Box, Button } from "@mui/material";

import { API_Endpoint } from "../../../../Configuration/Settings";
import { decryptData } from "../../../../utils/decryptData";
import { encryptData } from "../../../../utils/encryptData";
import { API_Handler } from "../../../../API/API_Handler";

const FileUploadModal = ({
  showModal,
  onClose,
  startDate,
  endDate,
  selectedGateway,
  selectedMid,
}: any) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [fileReadData, setFileReadData] = useState<any>([]);
  const [updatingRecord, setUpdatingRecord] = useState(false);
  const [data, setData] = useState<any>(null);

  const handleOnClose = () => {
    onClose();
    setData(null);
  };

  const handleReadBramhadevData = (e: any) => {
    const file = e.target.files[0];

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);

      const day = date.getDate();
      const year = date.getFullYear();

      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const month = months[date.getMonth()];

      return `${day} ${month}, ${year}`;
    };

    const formattedDate = formatDate(startDate);

    pdfToText(file)
      .then((text) => {
        let results: any[] = [];

        const transactions = text.split(/(?=Paid to)/g);

        transactions.forEach((chunk: string) => {
          if (chunk.includes(formattedDate)) {
            const Name = chunk.match(/Paid to (.*?) UPI/)?.[1] || "";
            const TxnID = chunk.match(/UPI Transaction ID:\s*(\d+)/)?.[1] || "";
            const Amount =
              chunk.match(/₹[\d,\.]+/)?.[0]?.replace(/[^\d]/g, "") || "";
            const PaidBy = chunk.match(/Paid by (.*?) ₹/)?.[1] || "";

            if (TxnID) {
              results.push({ Name, TxnID, Amount, PaidBy });
            }
          }
        });
        setFileReadData(results);
      })
      .catch(console.error);
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt: any) => {
      const data = evt.target.result;
      const isCSV = file.name.endsWith(".csv");

      const workbook = XLSX.read(data, {
        type: isCSV ? "string" : "array",
      });

      let finalData: any[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          raw: false,
        });

        const normalized = jsonData.map(normalizeRow);
        finalData = [...finalData, ...normalized];
      });

      setFileReadData(finalData);
    };

    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Key Cleaner (IMPORTANT)
  const cleanKey = (key: string) => {
    return key
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  // Column Mapping (Cleaned Format)
  const columnMap: any = {
    Name: ["name", "beneficiaryname", "beneficiary", "accountholder"],
    Number: ["number", "phone", "mobile", "contact"],
    Amount: ["amount", "amt", "value"],
    "Ac No": ["accountno", "accno", "accountnumber"],
    IFSC: ["ifsc", "ifsccode"],
  };

  const normalizeRow = (row: any) => {
    const newRow: any = {};

    Object.keys(row).forEach((key) => {
      const cleanedKey = cleanKey(key);
      for (let field in columnMap) {
        const match = columnMap[field].some(
          (col: string) => cleanedKey === col,
        );

        if (match && !newRow[field]) {
          newRow[field] = row[key];
        }
      }
    });

    return newRow;
  };

  // ===============================
  //  Amount Formatter
  // ===============================
  const formatAmount = (val: any) => {
    if (!val) return 0;

    return Number(String(val).replace(/,/g, "").replace(/-/g, "").trim());
  };

  // ===============================
  // Name Cleaner
  // ===============================
  const cleanName = (name: string) => {
    return name.replace(/\s+/g, " ")?.toLowerCase()?.trim();
  };

  // ===============================
  // MAIN MULTIPLE FILE HANDLER
  // ===============================
  const handleMultipleFiles = async (files: any) => {
    try {
      const results = await Promise.all(
        files.map(async (file: any) => {
          const text = await pdfToText(file);
          return parseAllBanks(text);
        }),
      );

      const merged = results.flat();
      setFileReadData(merged);
    } catch (err) {
      console.error("Error processing multiple files:", err);
    }
  };

  // ===============================
  // BANK PARSER
  // ===============================
  const parseAllBanks = async (text: string) => {
    let results: any[] = [];

    // Detect type
    const isGravity = text.includes("Beneficary Name") || text.includes("IMPS");

    const isShyam =
      text.includes("Account Statement") && text.includes("IMPS-");

    const isPixel = text.toLowerCase().includes("wdrl");

    const isAxis = text.includes("Axis Account") || text.includes("IMPS/P2A/");

    if (isAxis) {
      const cleanText = text.replace(/\s+/g, " ");
      const regex =
        /IMPS\/P2A\/(\d+)\/(.*?)\/.*?\s(\d{4,}(?:,\d{3})*\.\d{2})\s+DR/g;

      let match;

      while ((match = regex.exec(cleanText)) !== null) {
        const impsNo = match[1];
        const nameRaw = match[2];
        const amountRaw = match[3];

        results.push({
          Name: cleanName(nameRaw),
          IMPS: impsNo,
          Amount: formatAmount(amountRaw),
        });
      }
    }

    // ================================
    // 1. GRAVITY PARSER
    // ================================
    if (isGravity) {
      const cleanText = text.replace(/\n/g, " ").replace(/\s+/g, " ");

      const regex =
        /([A-Za-z]+?)\s*(\d{6,})\s*IMPS\s*([\d,]+(?:\.\d+)?)\s*([A-Z0-9]{8,11})\s*(\d{10})/gi;

      let match;
      while ((match = regex.exec(cleanText)) !== null) {
        results.push({
          Name: match[1],
          "Ac No": match[2],
          Amount: formatAmount(match[3]),
          IFSC: match[4],
          Number: match[5],
        });
      }
    }

    // ================================
    // 2. SHYAM TRADING PARSER
    // ================================
    if (isShyam) {
      const cleanText = text.replace(/\s+/g, " ");

      const regex =
        /IMPS-([A-Z0-9-]+)\s+FCM-\s*\w+\s+-(\d{1,3}(?:,\d{3})*\.\d{2})/gi;
      let match;

      const fetchUserDetails = async (token: string) => {
        try {
          let userToken = localStorage.getItem("token");
          const res = await fetch(
            "https://laxminarayan.live/api/User/searchUsers",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                accept: "application/json",
                Authorization: `Bearer ${userToken}`,
              },
              body: JSON.stringify({
                token: token,
              }),
            },
          );

          const data = await res.json();
          return data;
        } catch (err) {
          console.error("API error:", err);
          return null;
        }
      };

      const promises: any[] = [];
      setUpdatingRecord(true);
      while ((match = regex.exec(cleanText)) !== null) {
        const nameRaw = match[1];
        const amountRaw = match[2];

        const cleanedName = cleanName(nameRaw);
        const amount = formatAmount(amountRaw);
        const [name, id] = cleanedName?.split("-");
        promises.push(
          fetchUserDetails(encryptData({ name: name, _id: id })).then(
            (userDetails) => ({
              Amount: amount,
              "Ac No": userDetails?.data?.[0]?.accountNumber || "",
              IFSC: userDetails?.data?.[0]?.ifsc || "",
              Name: userDetails?.data?.[0]?.userBankName || "",
            }),
          ),
        );
      }

      results = await Promise.all(promises);
      setUpdatingRecord(false);
      return results;
    }
    // ================================
    // 3. PIXEL PARSER
    // ================================
    if (isPixel) {
      const regex = /wdrl.*?(-?\d{1,3}(,\d{3})*(\.\d+)?)/gi;

      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push({
          Name: "NA",
          "Ac No": "NA",
          Amount: formatAmount(match[1]),
          IFSC: "NA",
          Number: "NA",
        });
      }
    }

    return results?.filter(
      (item: any) => item.Name && item.Name.toLowerCase() !== "na",
    );
  };

  const handleFileOnChange = async (e: any) => {
    const files = Array.from(e?.target?.files || []);
    if (!files.length) return;
    try {
      if (["gateway", "zappay", "payzaro"].includes(selectedGateway)) {
        handleFileChange(e);
      } else if (
        ["bramhadev", "jk Bank", "personal"].includes(selectedGateway)
      ) {
        handleReadBramhadevData(e);
      } else if (
        ["yesBank", "kotak", "OFS-AXIS", "axis"].includes(selectedGateway)
      ) {
        await handleMultipleFiles(files);
      }
    } catch (err) {
      console.error("Error handling files:", err);
    }
  };

  const validateWithdrawal = async () => {
    try {
      setLoading(true);
      let token = localStorage.getItem("token");
      const response = await API_Handler.post(
        `${API_Endpoint}/transaction/withdrawal-sheet-comparison-report`,
        {
          withdrawalSheet: fileReadData,
          startDate: startDate,
          endDate: endDate,
          gatewayName: selectedGateway,
          mid: selectedMid,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            maxBodyLength: Infinity,
          },
        },
      );
      if (response.data?.success) {
        const decData = decryptData(response.data?.data);
        const ids = decData?.payload || {};
        setData(ids);
      }
    } catch (error) {
      console.error("Error validateWithdrawal:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => {
    if (selectedGateway === "") {
      alert("Gateway option should not be empty.");
    } else {
      validateWithdrawal();
    }
  };

  return (
    <Modal open={showModal} onClose={handleOnClose}>
      <Box
        sx={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "80%",
          margin: "100px auto",
          marginLeft: "15%",
          position: "relative",
          textAlign: "center",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <Button
          onClick={handleOnClose}
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            border: "1px solid gray",
            minWidth: "30px",
          }}
        >
          X
        </Button>

        <h5>Upload File</h5>
        <Box
          sx={{
            display: "flex",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          <Box sx={{ flex: 1, marginTop: 2 }}>
            <input
              type="file"
              accept=".xlsx, .xls, .pdf, .csv"
              multiple
              onChange={handleFileOnChange}
              style={{ width: "100%" }}
            />
          </Box>
        </Box>
        <br />
        <Button
          onClick={handleUpload}
          disabled={updatingRecord}
          sx={{
            border: "1px solid gray",
            marginRight: "10px",
          }}
        >
          Verify Data
        </Button>
        {data && (
          <>
            <div style={{ padding: "20px", fontFamily: "Arial" }}>
              <h5>📊 Summary</h5>
              <table cellPadding="10" className="table table-view">
                <thead style={{ background: "#f0f0f0" }}>
                  <tr>
                    <th>Metric</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Both in DB and Sheet</td>
                    <td>{data?.summary?.bothInSheetAndDbCount}</td>
                  </tr>
                  <tr>
                    <td>Sheet But Not In DB</td>
                    <td>{data?.summary?.sheetButNotInDbCount}</td>
                  </tr>
                  <tr>
                    <td>DB But Not In Sheet</td>
                    <td>{data?.summary?.dbButNotInSheetCount}</td>
                  </tr>
                  <tr>
                    <td>Amount Mismatch</td>
                    <td>{data?.summary?.amountMismatchCount}</td>
                  </tr>
                </tbody>
              </table>

              {data?.sheetButNotInDb?.length > 0 && (
                <>
                  <h6 style={{ marginTop: "30px" }}>❌ Sheet But Not In DB</h6>
                  <table cellPadding="10" className="table table-view">
                    <thead style={{ background: "#ffe5e5" }}>
                      <tr>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>Account No</th>
                        <th>IFSC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.sheetButNotInDb?.map(
                        (item: any, index: number) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.mobile}</td>
                            <td>{"**********"}</td>
                            <td>{item.ifsc}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </>
              )}

              {data?.dbButNotInSheet?.length > 0 && (
                <>
                  <h6 style={{ marginTop: "30px" }}>❌ DB But Not In Sheet</h6>
                  <table cellPadding="10" className="table table-view">
                    <thead style={{ background: "#ffe5e5" }}>
                      <tr>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>Account No</th>
                        <th>IFSC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.dbButNotInSheet?.map(
                        (item: any, index: number) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item?.dp_id}</td>
                            <td>{"**********"}</td>
                            <td>{item.ifsc}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </>
              )}

              {data?.amountMismatches?.length > 0 && (
                <>
                  <h6 style={{ marginTop: "30px" }}>⚠️ Amount Mismatch</h6>
                  <table cellPadding="10" className="table table-view">
                    <thead style={{ background: "#fff3cd" }}>
                      <tr>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>Account No</th>
                        <th>IFSC</th>
                        <th>Sheet Amount</th>
                        <th>DB Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.amountMismatches?.map(
                        (item: any, index: number) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{"**********"}</td>
                            <td>{"**********"}</td>
                            <td>{item.ifsc}</td>
                            <td style={{ color: "blue" }}>
                              {item.sheetAmount}
                            </td>
                            <td style={{ color: "red" }}>{item.dbAmount}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </>
        )}
      </Box>
    </Modal>
  );
};

export default FileUploadModal;
