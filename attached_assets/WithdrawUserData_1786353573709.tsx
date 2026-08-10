import { useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import { useContext, useState } from "react";
import axios from "axios";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import { formatDate, formatedTime } from "../../../../utils/utility";
import { Responsibilities } from "../../../../Configuration/Enums";
import { User_Context } from "../../../../Contexts/User";

const WithdrawUserData = () => {
  const location = useLocation();
  const data = location.state;
  const {
    list,
    withdrawals,
    name,
    mid,
    totalApprovedAmount,
    totalAmount,
    providerName,
    key,
    type,
    record,
  } = data || {};

  const { User, Set_User } = useContext<any>(User_Context);
  const listData = withdrawals || list || record?.[key];
  const [commentPopup, setCommentPopup] = useState(false);
  const [comment, setComment] = useState("");
  const [selectedData, setSelectedData] = useState({});

  const itcDate = (utcDate: string) => {
    const dateObj = new Date(utcDate);

    return dateObj.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleBotClick = async (item: any) => {
    const SERVER_MAP: Record<string, string> = {
      "1": "api2",
      "3": "api",
      default: "api",
    };

    const serverPrefix = SERVER_MAP[User?.data?.serverId] || SERVER_MAP.default;
    const apiUrl = `https://${serverPrefix}.ganesha999.com/API/`;
    const payload = {
      list_id: `990001`,
      list_name: `Withdrawal Campaign1`,
      campaign_id: "WDL1",
      leads: [
        {
          first_name: item?.name,
          phone_number: item?.mobile || item?.userMobile,
          city: item?.city,
          state: item?.state,
          email: item?.clientName,
          comments: item?.clientName,
          province: item?._id,
        },
      ],
    };
    try {
      await axios.post(apiUrl, payload, {
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Data sent successfully");
    } catch (error) {
      toast.error("API request failed");
    }
  };

  const handleCommentClick = (item: any) => {
    setCommentPopup(true);
    setSelectedData(item);
  };

  const handleSubmitClick = () => {
    // TODO:- Need ro add Logic
  };

  return (
    <div className="g-sidenav-show  bg-gray-100">
      <ToastContainer autoClose={2000} position="top-center" />
      <Sidenav />
      <main className="main-content position-relative">
        <div style={{ background: "#f8f9fa" }}>
          <Breadcrumbs tab={"Withdrawal User Data"} />
          <div className="container-fluid">
            <div className="row">
              {type !== "filterRecord" && (
                <>
                  <div className="col-6 col-xl-3 col-sm-3 pdrt  align-items-center mt-3 mb-3">
                    <label className="lbl"></label>
                    <b>
                      {" "}
                      Total Amount:- {`${totalAmount || totalApprovedAmount}`}
                    </b>
                  </div>
                  <div className="col-6 col-xl-3 col-sm-3 pdrt  align-items-center mt-3 mb-3">
                    <label className="lbl"></label>
                    <b> Count:- {`${list?.length || withdrawals?.length}`}</b>
                  </div>
                </>
              )}
            </div>
            <div className="col-12 col-xl-12 col-sm-12 pdrt  align-items-center mt-3 mb-3">
              <label className="lbl"></label>
              <b>
                {" "}
                Provider Name:-{" "}
                {`${mid || providerName || name || record?.mid}`}
              </b>
            </div>
          </div>
          <div className="col-12 mt-1">
            <div className="table-responsive">
              <table className="table table-view">
                <thead>
                  <tr>
                    <th className="text-center"></th>
                    <th className="text-center">
                      Account holder
                      <br />
                      Name
                    </th>
                    <th className="text-center">Amount</th>
                    <th className="text-center">Mobile</th>
                    <th className="text-center">Emp Code</th>
                    <th className="text-center">Account No</th>
                    <th className="text-center">Bank Name</th>
                    <th className="text-center">IFCS</th>
                    <th className="text-center">Commission Amount</th>
                    <th className="text-center">DP ID</th>
                    <th className="text-center">Action</th>
                    <th className="text-center">
                      Given By
                      <br />
                      (Bank Name)
                    </th>
                    <th className="text-center">Mid</th>
                    <th className="text-center">Transaction ID</th>
                    <th className="text-center">Comment</th>
                    <th className="text-center">Updated On</th>
                  </tr>
                </thead>
                <tbody>
                  {listData?.map((item: any, Index: number) => {
                    return (
                      <tr>
                        <td className="col-2">{Index + 1}</td>
                        <td className="col-2">{item?.accountHolderName}</td>
                        <td className="col-2">{item?.amount}</td>
                        <th className="text-center">
                          <>
                            {User?.data?.Responsibilities?.includes(
                              Responsibilities?.show_mobile,
                            )
                              ? (item?.mobile ?? "-")
                              : "**********"}
                            <div style={{ marginTop: "6px" }}>
                              <Button
                                className="withdraw-btn"
                                variant="contained"
                                color="primary"
                                size="small"
                                onClick={() => handleBotClick(item)}
                              >
                                Dialer Call
                              </Button>
                            </div>
                          </>
                        </th>
                        <td className="col-2">{item?.empCode ?? "-"}</td>
                        <td className="col-2">{item?.accountNo}</td>
                        <td className="col-2">{item?.bankName ?? "-"}</td>
                        <td className="col-2">
                          {item?.ifscCode || item?.ifsc || "-"}
                        </td>
                        <td className="col-2">
                          {item?.commissionAmount ?? "-"}
                        </td>
                        <td className="col-2">{item?.dp_id}</td>
                        <td className="col-2">
                          <div>{item?.action?.name}</div>
                          <div>{item?.action?.status}</div>
                          {item?.action?.date && (
                            <div>{itcDate(item?.action?.date)}</div>
                          )}
                        </td>
                        <td className="col-2">{item?.gatewayName ?? "-"}</td>
                        <td className="col-2">{item?.mid ?? "-"}</td>
                        <td className="col-2">{item?.transactionId ?? "-"}</td>
                        <td className="col-2">
                          <>
                            {item?.comment ?? "-"}
                            <div style={{ marginTop: "6px" }}>
                              <Button
                                className="withdraw-btn"
                                variant="contained"
                                color="primary"
                                size="small"
                                onClick={() => handleCommentClick(item)}
                              >
                                Add Comment
                              </Button>
                            </div>
                          </>
                        </td>
                        <td className="col-2">
                          {item?.updatedOn ? (
                            <div>
                              <div>{`${formatDate(item?.updatedOn)}`}</div>
                              <div>{`${formatedTime(item?.updatedOn)}`}</div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <div>
        <Dialog
          open={commentPopup}
          onClose={() => setCommentPopup(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle style={{ fontWeight: "bold" }}>Add Comment</DialogTitle>

          <DialogContent>
            <p style={{ marginBottom: 10 }}>Please enter a Valid Comment.</p>

            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder="Enter your comment..."
              variant="outlined"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </DialogContent>

          <DialogActions style={{ padding: "16px" }}>
            <Button variant="outlined" onClick={() => setCommentPopup(false)}>
              Cancel
            </Button>

            <Button
              variant="contained"
              color="primary"
              disabled={!comment}
              onClick={() => {
                handleSubmitClick();
              }}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default WithdrawUserData;
