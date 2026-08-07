import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilSquare } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { toast } from "react-toastify";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import Loader from "../../../../Components/Loader/Loader";
import { User_Context } from "../../../../Contexts/User";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { API_Handler } from "../../../../API/API_Handler";
import { formatedTime } from "../../../../utils/utility";
import { useLocation } from "react-router-dom";
import { encryptData } from "../../../../utils/encryptData";
import { decryptData } from "../../../../utils/decryptData";


interface TableColumn {
  label: string;
  key: string;
  type?: string;
}

const UserExposure = () => {
  const { User } = useContext(User_Context);
  const { state: customProps } = useLocation();

  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("SattaMatka");

  const [dataMap, setDataMap] = useState<any>({
    SattaMatka: [],
    Falcon: [],
    Jetfair: [],
    WCO: [],
    AAAExchange: [],
  });

  // Popup State
  const [editPopup, setEditPopup] = useState(false);
  const [editStatus, setEditStatus] = useState("l");
  const [editAmount, setEditAmount] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [editData, setEditData] = useState({ id: "", transactionId: "", wining: "0" });

  /** ---------- Helpers ---------- */
  const formatDate = (date: any) => {
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${d.getFullYear()}`;
  };

  const handleError = (message: string) => {
    console.error(message);
    toast.error(message);
  };

  /** ---------- API Calls ---------- */

  const getExposerLists = useCallback(async () => {
    if (!User?.token || !customProps) return;
    try {
      const response = await axios.post(
        `${API_Endpoint}/User/user-exposer-lists`,
        { token: encryptData({ _id: customProps }) },
        { headers: { Authorization: `Bearer ${User.token}` } }
      );
      const data = await decryptData(response.data.data);
      const { _sattaMatka, _falcon, _jetfair } = data.payload;
      setDataMap((prev: any) => ({
        ...prev,
        SattaMatka: _sattaMatka || [],
        Falcon: _falcon || [],
        Jetfair: _jetfair || [],
      }));
    } catch (error: any) {
      handleError(error.message);
    }
  }, [User?.token, customProps]);

  useEffect(() => {
    getExposerLists();
  }, [getExposerLists, currentPage]);

  const handleProvider = async (newValue: string) => {
    setProvider(newValue);
    if (!["WCO", "AAA Exchange"].includes(newValue) || !User?.data?._id) return;

    setLoading(true);
    try {
      const apiURL =
        newValue === "WCO"
          ? `${API_Endpoint}/User/find-wco-pending-bet`
          : `${API_Endpoint}/User/find-exchange-pending-bet`;

      const response = await axios.post(
        apiURL,
        { token: encryptData({ userId: customProps }) },
        { headers: { Authorization: `Bearer ${User.token}` } }
      );

      const decryptedData = await decryptData(response.data.data);
      setDataMap((prev: any) => ({
        ...prev,
        [newValue.replace(" ", "")]: decryptedData?.payload || [],
      }));
    } catch (error: any) {
      handleError(`Failed to fetch ${newValue} data`);
    } finally {
      setLoading(false);
    }
  };

  /** ---------- Edit Handlers ---------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (["WCO", "AAA Exchange"].includes(provider)) {
        // WCO or AAA Exchange update
        const payload: any = {
          userId: customProps,
          transactionId: editData.transactionId,
          updatedBy: { name: User?.data?.name, mobile: User?.data?.mobile },
        };

        if (provider === "WCO") {
          payload.wining = Number(editData.wining) || 0;
          payload.status = selectedStatus;
        } else {
          payload.status = selectedStatus;
        }

        const apiURL =
          provider === "WCO"
            ? `${API_Endpoint}/User/update-wcoWinning`
            : `${API_Endpoint}/User/find-exchange-pending-bet-and-update`;

        const response = await axios.post(
          apiURL,
          { token: encryptData(payload) },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        await decryptData(response.data.data);
        toast.success(`${provider} updated successfully!`);
        await handleProvider(provider);
      } else if (["Jetfair", "Falcon"]?.includes(provider)) {
        const payload: any = {
          status: selectedStatus,
          _id: editData.id,
          updatedBy: { name: User?.data?.name, mobile: User?.data?.mobile },
        };
        const apiURL =
          provider === "Falcon"
            ? `${API_Endpoint}/User/update-bets-falcon`
            : `${API_Endpoint}/User/update-bets-jetfair`

        const response = await axios.post(
          apiURL,
          { token: encryptData(payload) },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        await decryptData(response?.data?.data);
        toast.success(`${provider} updated successfully!`);
        await getExposerLists();
      } else {
        // Normal update
        const data = {
          _id: editData.id,
          status: editStatus,
          amount: editAmount,
          updatedBy: { _id: User.data._id, name: User.data.name },
        };
        const response = await API_Handler.post(
          `${API_Endpoint}/User/update-bets-admin`,
          { token: encryptData(data) },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        await decryptData(response?.data?.data);
        toast.success("Updated successfully!");
        await getExposerLists();
      }
    } catch (error: any) {
      handleError(error.message);
    } finally {
      setLoading(false);
      setEditPopup(false);
      setEditAmount("");
      setSelectedStatus("");
    }
  };

  const openEditPopup = (item: any) => {
    setEditPopup(true);
    setEditData({
      id: item?._id || "",
      transactionId: item.transactionId || "",
      wining: "0",
    });
  };

  /** ---------- Common UI Renderer ---------- */

  const renderTableUI = (columns: any, data: any[], provider: string) => {
    const keys = TABLE_CONFIGS[provider.replace(" ", "")] || [];

    return (
      <div className="table-responsive">
        <table className="table table-view">
          <thead>
            <tr>{columns.map((col: any) => <th key={col}>{col?.label}</th>)}</tr>
          </thead>
          <tbody>
            {data?.length ? (
              data.map((item: any, i: number) => (
                <tr key={i}>
                  {TABLE_CONFIGS[provider].map((col) => (
                    <td key={col.key}>{item?.type === "" ? `${formatDate(
                      item[col.key]
                    )} , ${formatedTime(item[col.key])}`
                      : item?.type === "layBack" ? item?.[col.key] ? "Back" : "Lay" : item?.[col.key]}</td>
                  ))}

                  <td>
                    <FontAwesomeIcon
                      icon={faPencilSquare}
                      onClick={() => openEditPopup(item)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center">
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  /** ---------- Table Configurations ---------- */

  const TABLE_CONFIGS: Record<string, TableColumn[]> = {
    SattaMatka: [
      { label: "Bazar Name", key: "bazar_name" },
      { label: "Bazar ID", key: "bazar_id" },
      { label: "Game Name", key: "gameName" },
      { label: "Game ID", key: "game_id" },
      { label: "Game", key: "game" },
      { label: "Game Type", key: "game_type" },
      { label: "Result Date", key: "result_date" },
      { label: "Transaction ID", key: "transaction_id" },
      { label: "Customer ID", key: "customer_id" },
      { label: "Point", key: "point" },
      { label: "Status", key: "status" },
      { label: "Created On", key: "createdOn", type: "date" },
      { label: "Updated On", key: "updatedOn", type: "date" },
    ],

    Falcon: [
      { label: "Event Name", key: "Eventname" },
      { label: "Event Type Name", key: "Eventtypename" },
      { label: "Market ID", key: "MarketID" },
      { label: "Market Name", key: "Marketname" },
      { label: "Market Type", key: "Markettype" },
      { label: "Runner ID", key: "RunnerID" },
      { label: "Runner Name", key: "Runnername" },
      { label: "TransactionID", key: "TransactionID" },
      { label: "Amount", key: "Amount" },
      { label: "Commission Amount", key: "CommissionAmount" },
      { label: "Cashout Amount", key: "cashoutAmount" },
      { label: "Payable Amount", key: "PayableAmount" },
      { label: "Session Point", key: "SessionPoint" },
      { label: "Point", key: "Point" },
      { label: "NetPL", key: "NetPL" },
      { label: "Rate", key: "Rate" },
      { label: "Stake", key: "Stake" },
      { label: "betStatus", key: "betStatus" },
      { label: "Bet Type", key: "BetType" },
      { label: "Updated On", key: "updatedOn", type: "date" },
    ],

    Jetfair: [
      { label: "Game Name", key: "gameName" },
      { label: "Runner Name", key: "runnerName" },
      { label: "Market Name", key: "marketName" },
      { label: "Market ID", key: "marketId" },
      { label: "Transaction ID", key: "transactionId" },
      { label: "Transaction Code", key: "transactionCode" },
      { label: "Transaction Type", key: "transactionType" },
      { label: "Amount", key: "amount" },
      { label: "Commission", key: "commissionAmount" },
      { label: "Rate", key: "rate" },
      { label: "Stake", key: "stake" },
      { label: "Net P/L", key: "netPL" },
      { label: "Status", key: "betStatus" },
      { label: "Bet Type", key: "betType" },
      { label: "Updated On", key: "updatedOn", type: "date" },
    ],

    WCO: [
      { label: "Provider Name", key: "providerName" },
      { label: "Game Name", key: "gameName" },
      { label: "Name", key: "Name" },
      { label: "Transaction ID", key: "transactionId" },
      { label: "Provider Transaction ID", key: "providerTransactionId" },
      { label: "Round ID", key: "roundId" },
      { label: "Action", key: "action" },
      { label: "Amount", key: "amount" },
      { label: "Winning", key: "wining" },
      { label: "Status", key: "status" },
      { label: "Created On", key: "createdOn", type: "date" },
      { label: "Updated On", key: "updatedOn", type: "date" },
    ],

    "AAA Exchange": [
      { label: "User ID", key: "userId" },
      { label: "Transaction ID", key: "transactionId" },
      { label: "Transaction Type", key: "transactionType" },
      { label: "Sport Name", key: "sportName" },
      { label: "Tournament Name", key: "tournamentName" },
      { label: "Game ID", key: "gameId" },
      { label: "Game Name", key: "gameName" },
      { label: "Game Name Exch", key: "gameNameExchange" },
      { label: "Market ID", key: "marketId" },
      { label: "Market Name", key: "marketName" },
      { label: "Market Type", key: "marketType" },
      { label: "Runner", key: "runner" },
      { label: "Bet Type", key: "isBack", type: "layBack" },
      { label: "Rate", key: "rate" },
      { label: "Run", key: "run" },
      { label: "Amount", key: "amount" },
      { label: "Bet Type", key: "balance" },
      { label: "Update On", key: "updatedOn", type: "date" },
      { label: "Bet Type", key: "balance" },
      { label: "_id", key: "_id" },
      { label: "_v", key: "_v" },
      { label: "Status", key: "status" },
      { label: "Action", key: "action" },
    ],
  };

  /** ---------- Render ---------- */

  return (
    <>
      {loading && <Loader />}
      <div className="g-sidenav-show bg-gray-100">
        <Sidenav />
        <main className="main-content position-relative">
          <Dialog open={editPopup} onClose={() => setEditPopup(false)}>
            <DialogTitle>
              {["WCO", "AAA Exchange"].includes(provider)
                ? `Update ${provider}`
                : "Update Record"}
            </DialogTitle>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <div className="label">Select Status</div>
                <select
                  style={{ width: "100%", height: "35px" }}
                  onChange={(e) =>
                    ["WCO", "AAA Exchange", "Falcon", "Jetfair"].includes(provider)
                      ? setSelectedStatus(e.target.value)
                      : setEditStatus(e.target.value)
                  }
                  value={
                    ["WCO", "AAA Exchange","Falcon", "Jetfair"].includes(provider)
                      ? selectedStatus
                      : editStatus
                  }
                >
                  {provider === "WCO" && (
                    <>
                      <option value="">Select Status</option>
                      <option value="L">Loss</option>
                      <option value="W">Win</option>
                      <option value="R">Rollback</option>
                      <option value="C">Completed</option>
                    </>
                  )}
                  {provider === "AAA Exchange" && (
                    <>
                      <option value="">Select Status</option>
                      <option value="Cancel">Cancel</option>
                      <option value="Resettle Market">Resettle Market</option>
                      <option value="C">Completed</option>
                    </>
                  )}
                  {provider === "Falcon" && (
                    <>
                      <option value="">Select Status</option>
                      <option value="C">Cancel</option>
                      <option value="W">Win</option>
                      <option value="L">Loss</option>
                    </>
                  )}
                  {provider === "Jetfair" && (
                    <>
                      <option value="">Select Status</option>
                      <option value="settle">settle</option>
                      <option value="Cancel">Cancel</option>
                    </>
                  )}
                  {!["WCO", "AAA Exchange", "Falcon", "Jetfair"].includes(provider) && (
                    <>
                      <option value="w">Win</option>
                      <option value="l">Loss</option>
                    </>
                  )}
                </select>

                {provider === "WCO" && ["W", "R"]?.includes(selectedStatus) && (
                  <input
                    type="number"
                    value={editData.wining}
                    onChange={(e) =>
                      setEditData({ ...editData, wining: e.target.value })
                    }
                    style={{ width: "100%", height: "35px", marginTop: "5px" }}
                    placeholder="Winning Amount"
                  />
                )}

                {!["WCO", "AAA Exchange"].includes(provider) &&
                  editStatus === "w" && (
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      style={{ width: "100%", height: "35px", marginTop: "5px" }}
                      placeholder="Enter Amount"
                    />
                  )}

                <DialogActions>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setEditPopup(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="outlined" color="primary" type="submit">
                    {loading ? "Updating..." : "Submit"}
                  </Button>
                </DialogActions>
              </form>
            </DialogContent>
          </Dialog>

          <div style={{ background: "#f8f9fa" }}>
            <Breadcrumbs tab={provider} />
            <div className="col-6 col-xl-2 col-sm-4 mt-1 mb-3 px-2">
              <label className="lbl">Select Provider</label>
              <Stateful_Select
                value={provider}
                onChange={handleProvider}
                options={[
                  "SattaMatka",
                  "Falcon",
                  "Jetfair",
                  "WCO",
                  "AAA Exchange",
                ]}
              />
            </div>
            <div className="container-fluid">
              {renderTableUI(
                TABLE_CONFIGS[provider],
                dataMap[provider.replace(" ", "")] || [],
                provider
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default UserExposure;
