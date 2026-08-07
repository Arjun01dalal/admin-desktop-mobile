

import React, { useState, useEffect, useContext } from "react";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";
import { User_Context } from "../../../../Contexts/User";
import axios from "axios";
import { decryptData } from "../../../../utils/decryptData";
import { useLocation, useParams } from "react-router-dom";
import { formatedTime } from "../../../../utils/utility";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilSquare } from "@fortawesome/free-solid-svg-icons";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import Loader from "../../../../Components/Loader/Loader";
import { API_Handler } from "../../../../API/API_Handler";

const UserExposure = () => {
  const { User } = useContext(User_Context);
  const location = useLocation();
  const customProps = location.state;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sattaMatkaData, setSattaMatkaData] = useState<any>([]);
  const [jetFairData, setJetfairData] = useState<any>([]);
  const [falconData, setFalconData] = useState<any>([]);
  const [provider, setProvider] = useState("SattaMatka");
  const [loading, setLoading] = useState(false);
  const [wcoData, setWcoData] = useState<any>([]);
  const [aaaExchangeData, setAaaExchangeData] = useState<any>([]);
  const [wcoEditPopup, setWcoEditPopup] = useState(false);
  const [wcoEditData, setWcoEditData] = useState({
    transactionId: "",
    wining: "",
  });

  const [statusError, setStatusError] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const formatedDate = (date: any) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString();
    return `${day}-${month}-${year}`;
  };
  const formattedDate = (timestamp: any) => formatedDate(new Date(timestamp));

  const getExposerLists = () => {
    let data = {
      _id: customProps,
    };
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/User/user-exposer-lists`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };
    axios
      .request(config)
      .then(async (response) => {
        response.data.data = await decryptData(response.data.data);
        console.log("response.data.data::", response.data.data);

        setSattaMatkaData(response.data.data.payload._sattaMatka);
        setFalconData(response.data.data.payload._falcon);
        setJetfairData(response.data.data.payload._jetfair);
      })
      .catch((error: any) => {
        console.log(error.message);
      });
  };

  useEffect(() => {
    getExposerLists();
  }, [currentPage]);

  const handleProvider = async (newValue: any) => {
    setProvider(newValue);

    if (!User?.data?._id) return;

    if (["WCO", "AAA Exchange"].includes(newValue)) {
      setLoading(true);
      try {
        const payload = { userId: customProps };
        const encrypted = encryptData(payload);
        const apiURL =
          newValue === "WCO"
            ? `${API_Endpoint}/User/find-wco-pending-bet`
            : `${API_Endpoint}/User/find-exchange-pending-bet`;

        const response = await axios.post(
          apiURL,
          { token: encrypted },
          {
            headers: { Authorization: `Bearer ${User.token}` },
          }
        );

        const decryptedData = await decryptData(response?.data?.data);

        if (newValue === "WCO") {
          setWcoData(decryptedData?.payload || []);
        }

        if (newValue === "AAA Exchange") {
          setAaaExchangeData(decryptedData?.payload || []);
        }
      } catch (error: any) {
        console.error("❌ Error fetching ${newValue} data:", error.message);
        toast.error(`Failed to fetch ${newValue} data`);
      } finally {
        setLoading(false);
      }
    }
  };

  const [editPopup, setEditPopup] = useState(false);
  const [editStatus, setEditStatus] = useState("l");
  const [editAmount, setEditAmount] = useState("");
  const [currentEditId, setCurrentEditId] = useState("");

  const handleSubmitData = (e: any) => {
    e.preventDefault();
    setLoading(true);
    let data = {
      _id: currentEditId,
      status: editStatus,
      amount: editAmount,
      updatedBy: {
        _id: User.data._id,
        name: User.data.name,
      },
    };
    let token = localStorage.getItem("token");
    console.log("data::", data);

    API_Handler.post(
      `${API_Endpoint}/User/update-bets-admin`,
      { token: encryptData(data) },
      {
        headers: {
          Authorization:` Bearer ${token}`,
        },
      }
    )
      .then((response) => {
        console.log("response::", decryptData(response?.data?.data));

        setLoading(false);
        setEditPopup(false);
        getExposerLists();
      })
      .catch((error) => {
        setEditPopup(false);
        toast.error(error.message);
        setLoading(false);
      })
      .finally(() => {
        setEditPopup(false);
      });
  };

  const handleWcoSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); // ✅ prevent full page reload

    if (!selectedStatus) {
      toast.error("Please select a status before submitting.");
      return;
    }

    setLoading(true);

    try {
      let payload: any = {
        userId: customProps,
        transactionId: wcoEditData.transactionId,
        updatedBy: {
          name: User?.data?.name,
          mobile: User?.data?.mobile,
        },
      };

      if (provider === "WCO") {
        payload.wining = Number(wcoEditData.wining) || 0;
        payload.status = selectedStatus;
      }

      if (provider === "AAA Exchange") {
        payload.status = selectedStatus;
      }

      let token = localStorage.getItem("token");

      const apiURL =
        provider === "WCO"
          ? `${API_Endpoint}/User/update-wcoWinning`
          : `${API_Endpoint}/User/find-exchange-pending-bet-and-update`;

      const encrypted = encryptData(payload);

      const response = await axios.post(
        apiURL,
        { token: encrypted },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const decryptDat = await decryptData(response.data.data);
      toast.success(`${provider} updated successfully!`);
      setWcoEditPopup(false);
      setSelectedStatus("");
      setWcoEditData({ transactionId: "", wining: "0" });
      await handleProvider(provider);
    } catch (error: any) {
      console.error("Update failed:", error.message);
      toast.error("Update failed!");
    } finally {
      setLoading(false);
    }
  };

  const openEditPopup = (item: any) => {
    provider === "SattaMatka" ? setEditPopup(true) : setWcoEditPopup(true);
    setWcoEditData({
      transactionId: item.transactionId,
      wining: "0", // start from 0 always
    });
    setSelectedStatus(""); // no preselected status
  };

  const handleStatusChange = (e: any) => {
    setEditStatus(e.target.value);
  };

  const handleAmountChange = (e: any) => {
    setEditAmount(e.target.value);
  };

  return (
    <>
      {loading && <Loader />}
      <div className="g-sidenav-show  bg-gray-100">
        <Sidenav />
        <main className="main-content position-relative">
          <div>
            <Dialog open={editPopup} onClose={() => setEditPopup(false)}>
              <DialogContent>
                <form onSubmit={handleSubmitData}>
                  <div>
                    <div className="label">Select Status</div>
                    <select
                      style={{ width: "100%", height: "35px" }}
                      onChange={handleStatusChange}
                      value={editStatus}
                      id=""
                    >
                      <option value="w">Win</option>
                      <option value="l">Loss</option>
                    </select>
                  </div>

                  {editStatus === "w" && (
                    <div style={{ marginTop: "5px" }}>
                      <div style={{ color: "#000", fontSize: "13px" }}>
                        Enter Amount
                      </div>
                      <input
                        type="text"
                        onChange={handleAmountChange}
                        value={editAmount}
                      />
                    </div>
                  )}

                  <DialogActions>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      onClick={() => setEditPopup(false)}
                      color="primary"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      type="submit"
                      color="primary"
                    >
                      Submit
                    </Button>
                  </DialogActions>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div>
            <Dialog
              open={wcoEditPopup || editPopup}
              onClose={() => {
                setWcoEditPopup(false);
                setEditPopup(false);
              }}
            >
              <DialogTitle>
                {provider === "AAA Exchange"
                  ? "Update AAA Exchange Record"
                  : provider === "WCO"
                  ? "Update WCO Winning"
                  : "Update Record"}
              </DialogTitle>

              <DialogContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault(); // ✅ stop full page reload
                    if (["WCO", "AAA Exchange"].includes(provider)) {
                      handleWcoSubmit(e);
                    } else {
                      handleSubmitData(e);
                    }
                  }}
                >
                  {/* ✅ Status Dropdown */}
                  <div style={{ marginBottom: "10px" }}>
                    <div className="label">Select Status</div>
                    <select
                      style={{ width: "100%", height: "35px" }}
                      onChange={(e) =>
                        ["WCO", "AAA Exchange"].includes(provider)
                          ? setSelectedStatus(e.target.value)
                          : handleStatusChange(e)
                      }
                      value={
                        ["WCO", "AAA Exchange"].includes(provider)
                          ? selectedStatus
                          : editStatus
                      }
                    >
                      {provider === "WCO" ? (
                        <>
                          <option value="">Select Status</option>
                          <option value="L">Loss</option>
                          <option value="W">Win</option>
                          <option value="R">Rollback</option>
                          <option value="C">Completed</option>
                        </>
                      ) : provider === "AAA Exchange" ? (
                        <>
                          <option value="">Select Status</option>
                          <option value="Cancel">Cancel</option>
                          <option value="Resettle Market">
                            Resettle Market
                          </option>
                          <option value="C">Completed</option>
                        </>
                      ) : (
                        <>
                          <option value="w">Win</option>
                          <option value="l">Loss</option>
                        </>
                      )}
                    </select>

                    {/* 🔴 Red warning if status not selected */}
                    {["WCO", "AAA Exchange"].includes(provider) &&
                      !selectedStatus && (
                        <p
                          style={{
                            color: "red",
                            fontSize: "13px",
                            marginTop: "6px",
                          }}
                        >
                          ⚠ Please select a status before updating.
                        </p>
                      )}
                  </div>

                  {/* ✅ Winning Amount input for WCO & AAA Exchange */}
                  {provider === "WCO" && selectedStatus === "W" && (
                    <div style={{ marginTop: "5px" }}>
                      <div style={{ color: "#000", fontSize: "13px" }}>
                        Winning Amount
                      </div>
                      <input
                        type="number"
                        value={wcoEditData.wining}
                        onChange={(e) =>
                          setWcoEditData({
                            ...wcoEditData,
                            wining: e.target.value,
                          })
                        }
                        style={{ width: "100%", height: "35px" }}
                      />
                    </div>
                  )}

                  {/* ✅ Enter Amount input for simple editPopup when status = win */}
                  {!["WCO", "AAA Exchange"].includes(provider) &&
                    editStatus === "w" && (
                      <div style={{ marginTop: "5px" }}>
                        <div style={{ color: "#000", fontSize: "13px" }}>
                          Enter Amount
                        </div>
                        <input
                          type="text"
                          onChange={handleAmountChange}
                          value={editAmount}
                          style={{ width: "100%", height: "35px" }}
                        />
                      </div>
                    )}

                  {/* ✅ Action Buttons */}
                  <DialogActions>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      color="primary"
                      onClick={() => {
                        setEditPopup(false);
                        setWcoEditPopup(false);
                      }}
                    >
                      Cancel
                    </Button>

                    <Button
                      className="btn-popup"
                      variant="outlined"
                      color="primary"
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? "Updating..." : "Submit"}
                    </Button>
                  </DialogActions>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div style={{ background: "#f8f9fa" }}>
            <Breadcrumbs tab={provider} />
            <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-1 mb-3 px-2">
              <label className="lbl">Select Provider</label>
              <Stateful_Select
                value={provider}
                onChange={(newValue: any) => handleProvider(newValue)}
                options={[
                  "SattaMatka",
                  "Falcon",
                  "Jetfair",
                  "WCO",
                  "AAA Exchange",
                ]}
              />
            </div>

            {/* Existing data tables */}
            {provider === "SattaMatka" && (
              <div className="container-fluid">
                <div className="col-12">
                  <div className="table-responsive">
                    <table className="table table-view">
                      <thead>
                        <tr>
                          <th></th>
                          <th>bazar Name</th>
                          <th>bazar Id</th>
                          <th>Game Name</th>
                          <th>Game Id</th>
                          <th>Game</th>
                          <th> Game Akda</th>
                          <th>Game Type</th>
                          <th>Result Date</th>
                          <th>Transaction Id</th>
                          <th>Customer Id</th>
                          <th>Point</th>
                          <th>Status</th>
                          <th>Created on</th>
                          <th>Updated on</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sattaMatkaData?.map((item: any, index: number) => (
                          <tr key={index} id={item._id}>
                            <td>{index + 1}</td>
                            <td>{item.bazar_name}</td>
                            <td>{item.bazar_id}</td>
                            <td>{item.gameName}</td>
                            <td>{item.game_id}</td>
                            <td>{item.game}</td>
                            <td>{item.game_name}</td>
                            <td>{item.game_type}</td>
                            <td>{item.result_date}</td>
                            <td>{item.transaction_id}</td>
                            <td>{item.customer_id}</td>
                            <td>{item.point}</td>
                            <td>{item.status}</td>
                            <td>{`${formattedDate(
                              item.createdOn
                            )} , ${formatedTime(item.createdOn)}`}</td>
                            <td>{`${formattedDate(
                              item.updatedOn
                            )} , ${formatedTime(item.updatedOn)}`}</td>
                            <td>
                              <FontAwesomeIcon
                                id={item._id}
                                className="fa fa-pencil-square icon-home icon-trash"
                                icon={faPencilSquare}
                                onClick={() => {
                                  setCurrentEditId(item?._id);
                                  openEditPopup(item);
                                }}
                                style={{ cursor: "pointer" }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {provider === "Falcon" && (
              <div className="container-fluid">
                <div className="col-12">
                  <div className="table-responsive">
                    <table className="table table-view">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Event Name</th>
                          <th>Event Type</th>
                          <th>Market Id</th>
                          <th>Market Name</th>
                          <th>Market Type</th>
                          <th>Runner Id</th>
                          <th>Runner Name</th>
                          <th>Transaction Id</th>
                          <th>Amount</th>
                          <th>Commission Amount</th>
                          <th>Cashout Amount</th>
                          <th>Paybale Amount</th>
                          <th>Session Point</th>
                          <th>Point</th>
                          <th>Net Pl</th>
                          <th>Rate</th>
                          <th>Stake</th>
                          <th>Bet Status</th>
                          <th>Bet Type</th>
                          <th>Updated on</th>
                        </tr>
                      </thead>
                      <tbody>
                        {falconData?.map((item: any, index: number) => (
                          <tr key={index} id={item._id}>
                            <td>{index + 1}</td>
                            <td>{item.Eventname}</td>
                            <td>{item.Eventtypename}</td>
                            <td>{item.MarketID}</td>
                            <td>{item.Marketname}</td>
                            <td>{item.Markettype}</td>
                            <td>{item.RunnerID}</td>
                            <td>{item.Runnername}</td>
                            <td>{item.TransactionID}</td>
                            <td>{item.Amount}</td>
                            <td>{item.CommissionAmount}</td>
                            <td>{item.cashoutAmount}</td>
                            <td>{item.PayableAmount}</td>
                            <td>{item.SessionPoint}</td>
                            <td>{item.Point}</td>
                            <td>{item.NetPL}</td>
                            <td>{item.Rate}</td>
                            <td>{item.Stake}</td>
                            <td>{item.betStatus}</td>
                            <td>{item.BetType}</td>
                            <td>{`${formattedDate(
                              item.createdOn
                            )} , ${formatedTime(item.createdOn)}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {provider === "Jetfair" && (
              <div className="container-fluid">
                <div className="col-12">
                  <div className="table-responsive">
                    <table className="table table-view">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Game Name</th>
                          <th>Runner Name</th>
                          <th>Market Name</th>
                          <th>Market Id</th>
                          <th>Transaction Id</th>
                          <th>Transaction Code</th>
                          <th>Transaction Type</th>
                          <th>Amount</th>
                          <th>Commission Amount</th>
                          <th>Rate</th>
                          <th>Stake</th>
                          <th>Net Pl</th>
                          <th>Bet Status</th>
                          <th>Bet Type</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jetFairData?.map((item: any, index: number) => (
                          <tr key={index} id={item._id}>
                            <td>{index + 1}</td>
                            <td>{item.gameName}</td>
                            <td>{item.runnerName}</td>
                            <td>{item.marketName}</td>
                            <td>{item.marketId}</td>
                            <td>{item.transactionId}</td>
                            <td>{item.transactionCode}</td>
                            <td>{item.transactionType}</td>
                            <td>{Math.floor(item.amount)}</td>
                            <td>{Math.floor(item.commissionAmount)}</td>
                            <td>{Math.floor(item.rate)}</td>
                            <td>{Math.floor(item.stake)}</td>
                            <td>{Math.floor(item.netpl)}</td>
                            <td>{item.betStatus}</td>
                            <td>{item.betType}</td>
                            <td>{`${formattedDate(
                              item.updatedOn
                            )} , ${formatedTime(item.updatedOn)}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {provider === "WCO" && (
              <div className="container-fluid">
                <div className="col-12">
                  <div className="table-responsive">
                    <table className="table table-view">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Provider Name</th>
                          <th>Game Name</th>
                          <th>Display Name</th>
                          <th>Transaction ID</th>
                          <th>Provider Transaction ID</th>
                          <th>Round ID</th>
                          <th>Action</th>
                          <th>Amount</th>
                          <th>Winning</th>
                          <th>Status</th>
                          <th>Created On</th>
                          <th>Updated On</th>
                          <th>Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wcoData?.length > 0 ? (
                          wcoData.map((item: any, index: number) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{item?.providerName || "-"}</td>
                              <td>{item?.gameName || "-"}</td>
                              <td>{item?.Name || "-"}</td>
                              <td>{item?.transactionId || "-"}</td>
                              <td>{item?.providerTransactionId || "-"}</td>
                              <td>{item?.roundId || "-"}</td>
                              <td>{item?.action || "-"}</td>
                              <td>{item?.amount || 0}</td>
                              <td>{item?.wining || 0}</td>
                              <td>{item?.status || "-"}</td>
                              <td>
                                {item?.createdOn
                                  ? `${formattedDate(
                                      item.createdOn
                                    )} , ${formatedTime(item.createdOn)}`
                                  : "-"}
                              </td>
                              <td>
                                {item?.updatedOn
                                  ? `${formattedDate(
                                      item.updatedOn
                                    )} , ${formatedTime(item.updatedOn)}`
                                  : "-"}
                              </td>
                              <td>
                                <FontAwesomeIcon
                                  id={item._id}
                                  className="fa fa-pencil-square icon-home icon-trash"
                                  icon={faPencilSquare}
                                  onClick={() => openEditPopup(item)}
                                  style={{ cursor: "pointer" }}
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={13} className="text-center">
                              No data found for WCO
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {provider === "AAA Exchange" && (
              <div className="container-fluid">
                <div className="col-12">
                  <div className="table-responsive">
                    <table className="table table-view">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>User ID</th>
                          <th>Transaction ID</th>
                          <th>Transaction Type</th>
                          <th>Sport Name</th>
                          <th>Tournament Name</th>
                          <th>Game ID</th>
                          <th>Game Name</th>
                          <th>Match Name</th>
                          <th>Market ID</th>
                          <th>Market Name</th>
                          <th>Market Type</th>
                          <th>Runner</th>
                          <th>Bet Type</th>
                          <th>Rate</th>
                          <th>Run</th>
                          <th>Amount</th>
                          <th>Balance</th>
                          <th>Status</th>
                          <th>Created On</th>
                          <th>Updated On</th>
                          <th>_id</th>
                          <th>__v</th>
                          <th>Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aaaExchangeData?.length > 0 ? (
                          aaaExchangeData.map((item: any, index: number) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{item?.userId || "-"}</td>
                              <td>{item?.transactionId || "-"}</td>
                              <td>{item?.transactionType || "-"}</td>
                              <td>{item?.sportName || "-"}</td>
                              <td>{item?.tournamentName || "-"}</td>
                              <td>{item?.gameId || "-"}</td>
                              <td>{item?.gameName || "-"}</td>
                              <td>{item?.gameNameExchange || "-"}</td>
                              <td>{item?.marketId || "-"}</td>
                              <td>{item?.marketName || "-"}</td>
                              <td>{item?.marketType || "-"}</td>
                              <td>{item?.runner || "-"}</td>
                              <td>{item?.isBack ? "Back" : "Lay"}</td>
                              <td>{item?.rate ?? "-"}</td>
                              <td>{item?.run ?? "-"}</td>
                              <td>{item?.amount ?? 0}</td>
                              <td>{item?.balance ?? 0}</td>
                              <td>{item?.status || "-"}</td>
                              <td>
                                {item?.createdOn
                                  ? `${formattedDate(
                                      item.createdOn
                                    )} , ${formatedTime(item.createdOn)}`
                                  : "-"}
                              </td>
                              <td>
                                {item?.updatedOn
                                  ? `${formattedDate(
                                      item.updatedOn
                                    )} , ${formatedTime(item.updatedOn)}`
                                  : "-"}
                              </td>
                              <td>{item?._id || "-"}</td>
                              <td>{item?.__v ?? "-"}</td>
                              <td>
                                <FontAwesomeIcon
                                  id={item._id}
                                  className="fa fa-pencil-square icon-home icon-trash"
                                  icon={faPencilSquare}
                                  onClick={() => {
                                    setCurrentEditId(item._id);
                                    openEditPopup(item);
                                  }}
                                  style={{ cursor: "pointer" }}
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={23} className="text-center">
                              No data found for AAA Exchange
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default UserExposure;

