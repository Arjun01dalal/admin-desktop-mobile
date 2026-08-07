import React, { useState, useEffect, useContext, ChangeEvent } from "react";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import axios from "axios";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";
import { decryptData } from "../../../../utils/decryptData";
import { User_Context } from "../../../../Contexts/User";
import { Pagination, Stack } from "@mui/material";
import Button from "@mui/material/Button";
import Loader from "../../../../Components/Loader/Loader";
import { ToastContainer, toast } from "react-toastify";
import { formatDate, formatedTime } from "../../../../utils/utility";
import { dateTime } from "../../../../utils/utility";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// Components
import SearchBar from "../../../../Components/SearchBox/Search";

//// Css
import "./BonusWallet.css";
import { useNavigate } from "react-router-dom";
import { Responsibilities } from "../../../../Configuration/Enums";

interface BonusWallet {
  _id: string;
  mobile: string;
  amount: number;
  name: string;
  userId: string;
  status: string;
  updatedOn: string;
  updatedBy: {
    name: string;
    _id: string;
    date: string;
  };
}

interface TotalWalletData {
  pendingCount: number;
  totalAmountTransferToMainWallet: number;
  totalBonusWallet: number;
  totalBonusWalletCount: number;
  totalCountTransferToMainWallet: number;
  totalPendingAmount: number;
}

function BonusWallet() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [selectStatus, setSelectStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { User } = useContext(User_Context);
  const [bonusWalletData, setBonusWalletData] = useState<Array<BonusWallet>>(
    []
  );
  const [loading, setLoading] = useState<boolean>(false);

  const [isAllData, setIsAllData] = useState(false);
  const [totalAmount, setTotalAmount] = useState<TotalWalletData>();

  const [searchUserName, setSearchUserName] = useState<string>("");
  const [searchUserMobile, setSearchUserMobile] = useState<string>("");
  const [searchTransactionId, setSearchTransactionId] = useState<string>("");
  const navigate = useNavigate();

  const handlePerPage = (newValue: any) => {
    setSelectStatus(newValue);
  };

  const handleAction = (
    e?: any,
    status?: string,
    userId?: string,
    _id?: string,
    amount?: number
  ) => {
    e.preventDefault();
    setLoading(true);
    let data = {
      userId: userId,
      _id: _id,
      amount: amount,
      status: selectStatus ? selectStatus : status,
      updatedBy: {
        name: User.data.name,
        _id: User.data._id,
        status: status,
      },
    };
    axios
      .request({
        method: "post",
        url: `${API_Endpoint}/bonus-wallet/update-transferRequest`,
        headers: { Authorization: `Bearer ${User.token}` },
        data: { token: encryptData(data) },
      })
      .then((response) => {
        getAllData();
        setLoading(false);
      })
      .catch((error: any) => {
        toast.error(error.message);
        setLoading(false);
      });
  };
  const clearDate = () => {
    setStartDate("");
    setEndDate("");
  };

  const getAllData = (e?: any) => {
    setLoading(true);
    let id = e?.target?.id;
    let filter: { status?: string } = {};
    if (selectStatus) {
      filter.status = selectStatus;
    }
    let data: any = {};
    if (startDate && endDate && id !== "alldata") {
      data = {
        itemsPerPage: itemsPerPage,
        pageNo: currentPage,
        filter: filter,
        startDate: startDate,
        endDate: endDate,
      };
    } else {
      data = {
        itemsPerPage: itemsPerPage,
        pageNo: currentPage,
        filter: filter,
      };
    }

    if (
      searchUserName.length > 0 &&
      searchUserMobile.length === 0 &&
      searchTransactionId.length === 0
    ) {
      data.filter.name = searchUserName;
    } else if (
      searchUserMobile.length > 0 &&
      searchUserName.length === 0 &&
      searchTransactionId.length === 0
    ) {
      data.filter.mobile = searchUserMobile;
    } else if (
      searchTransactionId.length > 0 &&
      searchUserName.length === 0 &&
      searchUserMobile.length === 0
    ) {
      data.filter._id = searchTransactionId;
    } else if (
      searchUserMobile.length > 0 &&
      searchUserName.length > 0 &&
      searchTransactionId.length === 0
    ) {
      data.filter.name = searchUserName;
      data.filter.mobile = searchUserMobile;
    } else if (
      searchUserMobile.length > 0 &&
      searchTransactionId.length > 0 &&
      searchUserName.length === 0
    ) {
      data.filter.mobile = searchUserMobile;
      data.filter._id = searchTransactionId;
    } else if (
      searchUserName.length > 0 &&
      searchTransactionId.length > 0 &&
      searchUserMobile.length === 0
    ) {
      data.filter.name = searchUserName;
      data.filter._id = searchTransactionId;
    } else if (
      searchUserName.length > 0 &&
      searchTransactionId.length > 0 &&
      searchUserMobile.length > 0
    ) {
      data.filter.name = searchUserName;
      data.filter.mobile = searchUserMobile;
      data.filter._id = searchTransactionId;
    }

    axios
      .request({
        method: "post",
        url: `${API_Endpoint}/bonus-wallet/get-transferRequest`,
        headers: { Authorization: `Bearer ${User.token}` },
        data: { token: encryptData(data) },
      })
      .then(async (response) => {
        response.data.data = await decryptData(response.data.data);
        setBonusWalletData(response.data.data.payload.items);
        setTotalPages(response.data.data.payload.totalPages);
        if (id === "alldata") {
          getAllBonusWalletFundRequests(true);
        } else {
          getAllBonusWalletFundRequests(false);
        }

        setLoading(false);
      })
      .catch((error) => {
        toast.error(error.message);
        setLoading(false);
      });
  };

  const getAllBonusWalletFundRequests = (getAll: boolean) => {
    setLoading(true);
    const token = localStorage.getItem("token");
    let data = {};
    if (startDate && endDate) {
      data = {
        startDate: dateTime(startDate),
        endDate: dateTime(endDate),
        allData: false,
      };
    } else {
      // const currentDate = new Date().toISOString().split("T")[0];
      const currentDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      data = {
        startDate: dateTime(currentDate),
        endDate: dateTime(currentDate),
        allData: false,
      };
    }

    if (getAll) {
      setIsAllData(true);
      // const currentDate = new Date().toISOString().split("T")[0];
      const currentDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      data = {
        allData: true,
      };
    }

    if (token) {
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/bonus-wallet/fund-request`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { token: encryptData(data) },
      };
      axios
        .request(config)
        .then(async (response) => {
          response.data.data = await decryptData(response.data.data);
          setTotalAmount(response.data.data.payload);
          // setSubAdmin(response.data.data.payload.data)
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    getAllData();
  }, [currentPage, itemsPerPage, selectStatus]);

  const filterTransaction = () => {
    getAllData();
  };

  const handleSearchUserName = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserName(event.target.value);
  };

  const handleSearchTransactionId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTransactionId(event.target.value);
  };

  const handleSearchMobile = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserMobile(event.target.value);
  };

  // copty mobile
  const copyMobile = async (textToCopy: any) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${textToCopy} Coppied`);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <>
      {loading ? (
        <Loader />
      ) : (
        <div className="g-sidenav-show  bg-gray-100">
          <ToastContainer autoClose={2000} position="top-center" />
          <Sidenav />
          <main className="main-content position-relative">
            <div style={{ background: "#f8f9fa" }}>
              <Breadcrumbs tab={"Bonus Wallet Requests"} />
              <div className="container-fluid">
                <div className="row">
                  <div className="row tp-form">
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl">From Date</label>
                      <input
                        type="date"
                        className="form-control"
                        placeholder="From Date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl">To Date</label>
                      <input
                        type="date"
                        className="form-control"
                        placeholder="To Date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl">Items Per Page</label>
                      <div className="mt-1">
                        <Stateful_Select
                          value={itemsPerPage.toString()}
                          onChange={(newValue: any) => handlePerPage(newValue)}
                          options={["10", "25", "50", "75", "100"]}
                          className="deposit-select"
                        />
                      </div>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl">Select Type</label>
                      <div className="mt-1">
                        <Stateful_Select
                          value={selectStatus}
                          onChange={(newValue: any) => handlePerPage(newValue)}
                          options={["pending", "remove", "approve", "reject"]}
                          className="deposit-select"
                          label="Select Status"
                        />
                      </div>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a onClick={getAllData} className="sechBtn mt-1">
                        Apply
                      </a>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a
                        id="alldata"
                        onClick={(e) => getAllData(e)}
                        className="sechBtn mt-1"
                      >
                        All Data
                      </a>
                    </div>

                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a onClick={clearDate} className="sechBtn mt-1">
                        Clear Dates
                      </a>
                    </div>
                  </div>
                  <div className="col-6 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                    <label className="lbl"></label>
                    <b>
                      Approved Requests:{" "}
                      {`(${
                        totalAmount?.totalCountTransferToMainWallet
                          ? totalAmount?.totalCountTransferToMainWallet
                          : 0
                      })`}
                    </b>
                  </div>
                  <div className="col-6 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                    <label className="lbl"></label>
                    <b>
                      Wallet Balance:{" "}
                      {`(${
                        totalAmount?.totalAmountTransferToMainWallet
                          ? totalAmount?.totalAmountTransferToMainWallet
                          : 0
                      })`}
                    </b>
                  </div>
                  <div className="col-6 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                    <label className="lbl"></label>
                    <b>
                      Pending Requests:{" "}
                      {`(${
                        totalAmount?.pendingCount
                          ? totalAmount?.pendingCount
                          : 0
                      })`}
                    </b>
                  </div>
                  <div className="col-12  bonusTable">
                    <div className="table-responsive">
                      <table className="table table-view">
                        <thead>
                          <tr>
                            <th></th>
                            <th>User Name</th>
                            <th>Transaction Id</th>
                            <th>Amount</th>
                            <th>Mobile</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Action</th>
                            <th>Updated By</th>
                          </tr>
                          <tr>
                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserName}
                                  onChange={handleSearchUserName}
                                  onSearch={filterTransaction}
                                  placeholder="Search by user name"
                                />
                              </div>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchTransactionId}
                                  onChange={handleSearchTransactionId}
                                  onSearch={filterTransaction}
                                  placeholder="Search by transaction ID"
                                />
                              </div>
                            </th>
                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserMobile}
                                  onChange={handleSearchMobile}
                                  onSearch={filterTransaction}
                                  placeholder="Search by mobile"
                                />
                              </div>
                            </th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bonusWalletData.map((item, index) => (
                            <tr id={item._id} key={item._id}>
                              <td>
                                {index +
                                  1 +
                                  (currentPage && itemsPerPage
                                    ? (currentPage - 1) * itemsPerPage
                                    : 0)}
                              </td>
                              <td
                                style={{ cursor: "pointer" }}
                                onClick={() => {
                                  const url = `/bonus-wallet-history/${item.userId}`;
                                  navigate(url);
                                }}
                              >
                                {item.name}
                              </td>
                              <td>{item._id}</td>
                              <td>{item.amount}</td>
                              <td>
                                {User?.data?.Responsibilities?.includes(
                                  Responsibilities?.show_mobile
                                ) ? (
                                  <>
                                    {item?.mobile}{" "}
                                    <ContentCopyIcon
                                      onClick={() => copyMobile(item?.mobile)}
                                      style={{
                                        color: "#333",
                                        fontSize: "17px",
                                        marginLeft: "10px",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </>
                                ) : (
                                  `**********`
                                )}
                              </td>
                              <td>{item.status}</td>
                              <td>{formatDate(item.updatedOn)}</td>
                              <td>{formatedTime(item.updatedOn)}</td>
                              <td>
                                <span>
                                  {
                                    <Button
                                      onClick={(e) =>
                                        handleAction(
                                          e,
                                          "approve",
                                          item.userId,
                                          item._id,
                                          item.amount
                                        )
                                      }
                                      disabled={item.status !== "pending"}
                                      variant="contained"
                                      className="btn-withdraw"
                                    >
                                      Approve
                                    </Button>
                                  }
                                </span>
                                <span>
                                  {
                                    <Button
                                      onClick={(e) =>
                                        handleAction(
                                          e,
                                          "reject",
                                          item.userId,
                                          item._id,
                                          item.amount
                                        )
                                      }
                                      disabled={item.status !== "pending"}
                                      variant="contained"
                                      className="btn-withdraw"
                                    >
                                      Reject
                                    </Button>
                                  }
                                </span>
                                <span>
                                  {
                                    <Button
                                      onClick={(e) =>
                                        handleAction(
                                          e,
                                          "remove",
                                          item.userId,
                                          item._id,
                                          item.amount
                                        )
                                      }
                                      disabled={item.status !== "pending"}
                                      variant="contained"
                                      className="btn-withdraw"
                                    >
                                      Remove
                                    </Button>
                                  }
                                </span>
                              </td>
                              <td>
                                {item.updatedBy.name
                                  ? `${item.status} by ${item.updatedBy.name}`
                                  : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="pagination d-flex justify-content-center">
                      <Stack spacing={2}>
                        <Pagination
                          count={totalPages}
                          color="secondary"
                          page={currentPage}
                          onChange={(Event, New_Page) =>
                            setCurrentPage(New_Page)
                          }
                        />
                      </Stack>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  );
}

export default BonusWallet;
