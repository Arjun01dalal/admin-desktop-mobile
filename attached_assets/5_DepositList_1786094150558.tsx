import React, { useContext, useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";

import { Box, CircularProgress, Pagination, Stack } from "@mui/material";

import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import { formatDate, formatedTime } from "../../../../utils/utility";
import { Responsibilities } from "../../../../Configuration/Enums";
import { API_Endpoint } from "../../../../Configuration/Settings";
import SearchBar from "../../../../Components/SearchBox/Search";
import { decryptData } from "../../../../utils/decryptData";
import { encryptData } from "../../../../utils/encryptData";
import { API_Handler } from "../../../../API/API_Handler";
import { User_Context } from "../../../../Contexts/User";
import "../../../../Css/style.css";
import "../../../../Css/table.css";
import "../../../../Css/users.css";
import "../Deposit/Deposit.css";

function DepositList() {
  const navigate = useNavigate();
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [midData, setMidData] = useState<any>(null);
  const { User: User1 } = useContext(User_Context);
  const [lastActivity, setLastActivity] = useState("");
  const [midName, setMidName] = useState(
    localStorage?.getItem("midName") ?? "",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [appName, setAppName] = useState("");
  const [userId, setUserId] = useState("");
  const [mobile, setMobile] = useState("");
  const [state, setState] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  const getData = async () => {
    const data: any = {
      itemsPerPage: 1,
      pageNo: 1,
      filter: {
        name: name,
        mobile: mobile,
        city: city,
        state: state,
        userId: userId,
        clientName: appName,
      },
    };

    const config = {
      method: "post",
      url: `${API_Endpoint}/transaction/approved-deposit-withdrawal-report`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${User1.token}`,
      },
      data: { token: encryptData(data) },
    };

    setLoading(true);

    API_Handler.request(config)
      .then(async (response) => {
        response.data.data = await decryptData(response?.data?.data);
        setMidData(response?.data?.data?.payload?.midWiseTotals);
      })
      .catch((error) => {
        toast.error(error?.response?.data?.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getData1 = async () => {
    const data: any = {
      itemsPerPage: itemsPerPage,
      pageNo: currentPage,
      filter: {
        name: name,
        mobile: mobile,
        city: city,
        state: state,
        userId: userId,
        clientName: appName,
        mid: midName,
      },
    };
    if (startDate && endDate) {
      data.startDate = startDate;
      data.endDate = endDate;
    }
    const config = {
      method: "post",
      url: `${API_Endpoint}/transaction/approved-deposit-withdrawal-report`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${User1.token}`,
      },
      data: { token: encryptData(data) },
    };

    setLoading(true);

    API_Handler.request(config)
      .then(async (response) => {
        response.data.data = await decryptData(response?.data?.data);
        setTotalPages(response?.data?.data?.payload?.totalPages);
        setData(response?.data?.data?.payload);
      })
      .catch((error) => {
        toast.error(error?.response?.data?.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const clearFilter = () => {
    setStartDate("");
    setEndDate("");
    localStorage?.removeItem("midName");
    setMidName("");
  };

  const getWithdrawalPercentage = (deposit: any, withdrawal: any) => {
    if (!deposit || deposit === 0) return 0;
    return ((withdrawal / deposit) * 100).toFixed(2);
  };

  useEffect(() => {
    getData();
    getData1();
  }, []);

  useEffect(() => {
    getData1();
  }, [midName, currentPage, itemsPerPage, startDate, endDate]);

  const handlePerPage = (newValue: any) => {
    const perPage = parseInt(newValue, 10);
    setItemsPerPage(perPage);
  };

  return (
    <>
      <div className="g-sidenav-show  bg-gray-100">
        <ToastContainer autoClose={2000} position="top-center" />
        <Sidenav />
        <main className="main-content position-relative">
          <div style={{ background: "#f8f9fa" }}>
            <Breadcrumbs tab={"Deposit List"} />
            <div className="container-fluid">
              <div className="row">
                <div className="row tp-form mb-1" style={{ display: "flex" }}>
                  <>
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
                      <label className="lbl"></label>
                      <a onClick={getData1} className="sechBtn mt-1">
                        Apply
                      </a>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a onClick={clearFilter} className="sechBtn mt-1">
                        Clear Filter
                      </a>
                    </div>
                    <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                      <label className="lbl"></label>
                      <b>Deposit Amt:- {data?.totals?.totalDepositAmount}</b>
                    </div>
                    <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                      <label className="lbl"></label>
                      <b>
                        Withdrawal Amt:- {data?.totals?.totalWithdrawalAmount}
                      </b>
                    </div>
                  </>
                </div>
              </div>
            </div>
            <div className="container-fluid mb-3 mt-1">
              <div className="row">
                <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-1">
                  <label className="lbl">Select Mid</label>
                  <Stateful_Select
                    value={midName}
                    onChange={(newValue) => {
                      localStorage?.setItem("midName", newValue);
                      setMidName(newValue);
                    }}
                    options={midData?.map((item: any) => item?.mid) ?? []}
                  />
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-1">
                  <label className="lbl">Items Per Page</label>
                  <Stateful_Select
                    value={itemsPerPage.toString()}
                    onChange={(newValue: any) => handlePerPage(newValue)}
                    options={["10", "25", "50", "75", "100", "250"]}
                  />
                </div>
              </div>
            </div>
            <h6>Details List</h6>
            {loading ? (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                height="100%"
                minHeight="200px"
              >
                <CircularProgress size={25} />
              </Box>
            ) : (
              <table className="table table-view w-full border border-gray-200 rounded-lg shadow-md">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left"></th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">User Id</th>
                    <th className="px-4 py-2 text-left">Mobile</th>
                    <th className="px-4 py-2 text-left">City</th>
                    <th className="px-4 py-2 text-left">state</th>
                    <th className="px-4 py-2 text-left">Client Name</th>
                    <th className="px-4 py-2 text-left">
                      Last Activity
                      <br />
                      date
                    </th>
                    <th className="px-4 py-2 text-left">Ratio</th>
                    <th className="px-4 py-2 text-left">
                      Deposit
                      <br />
                      Withdrawal Ratio
                    </th>
                    <th className="px-4 py-2 text-left">
                      Deposit
                      <br />
                      Details
                    </th>
                    <th className="px-4 py-2 text-left">
                      Withdrawal
                      <br />
                      Details
                    </th>
                  </tr>
                </thead>
                <thead>
                  <td className="thdr"></td>
                  <td className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={name}
                        onChange={(e: any) => setName(e?.target?.value)}
                        onSearch={getData}
                        placeholder="Search by Name"
                      />
                    </div>
                  </td>
                  <td className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={userId}
                        onChange={(e: any) => setUserId(e?.target?.value)}
                        onSearch={getData}
                        placeholder="Search by DP Id"
                      />
                    </div>
                  </td>
                  <td className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={mobile}
                        onChange={(e: any) => setMobile(e?.target?.value)}
                        onSearch={getData}
                        placeholder="Search by Mobile"
                      />
                    </div>
                  </td>
                  <td className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={city}
                        onChange={(e: any) => setCity(e?.target?.value)}
                        onSearch={getData}
                        placeholder="Search by City"
                      />
                    </div>
                  </td>
                  <td className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={state}
                        onChange={(e: any) => setState(e?.target?.value)}
                        onSearch={getData}
                        placeholder="Search by State"
                      />
                    </div>
                  </td>
                  <td className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={appName}
                        onChange={(e: any) => setAppName(e?.target?.value)}
                        onSearch={getData}
                        placeholder="Search by App Name"
                      />
                    </div>
                  </td>
                  <td className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={lastActivity}
                        onChange={(e: any) => setLastActivity(e?.target?.value)}
                        onSearch={getData}
                        placeholder="Search by Last Activity"
                      />
                    </div>
                  </td>
                  <td className="thdr"></td>
                  <td className="thdr"></td>
                  <td className="thdr"></td>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={100}
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        <Box
                          display="flex"
                          justifyContent="center"
                          alignItems="center"
                        >
                          <CircularProgress />
                        </Box>
                      </td>
                    </tr>
                  ) : (
                    (data?.items || [])
                      .slice()
                      .sort((a: any, b: any) => {
                        const dateA = a?.activeUser || "";
                        const dateB = b?.activeUser || "";
                        return dateB.localeCompare(dateA);
                      })
                      .map((item: any, index: number) => {
                        return (
                          <tr
                            key={index}
                            className="border-t hover:bg-gray-50 transition"
                          >
                            <td className="px-4 py-3">
                              {index +
                                1 +
                                (currentPage && itemsPerPage
                                  ? (currentPage - 1) * itemsPerPage
                                  : 0)}
                            </td>
                            <td className="px-4 py-3">{item?.name}</td>
                            <td className="px-4 py-3">{item?.userId}</td>
                            <td className="px-4 py-3">
                              {User1?.data?.Responsibilities?.includes(
                                Responsibilities.show_mobile,
                              )
                                ? item?.mobile
                                : "**********"}
                            </td>
                            <td className="px-4 py-3">{item?.city}</td>
                            <td className="px-4 py-3">{item?.state}</td>
                            <td className="px-4 py-3">{item?.clientName}</td>
                            <td className="px-4 py-3">{`${formatDate(item?.activeUser)}- ${formatedTime(item?.activeUser)}`}</td>
                            <td className="px-4 py-3">
                              {getWithdrawalPercentage(
                                item?.approvedDepositAmount,
                                item?.approvedWithdrawalAmount,
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {item?.approvedDepositAmount -
                                item?.approvedWithdrawalAmount}
                              {/* )} */}
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className="d-flex flex-column"
                                onClick={() =>
                                  navigate("/depositListUserWise", {
                                    state: {
                                      data: item?.approvedDepositAmountByMid,
                                    },
                                  })
                                }
                              >
                                <span>
                                  Approved Amt:- {item?.approvedDepositAmount}
                                </span>
                                <span>
                                  Count:- {item?.approvedDepositCount}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className="d-flex flex-column"
                                onClick={() =>
                                  item?.approvedWithdrawalAmountByMid?.length >
                                    0 &&
                                  navigate("/depositListUserWise", {
                                    state: {
                                      data: item?.approvedWithdrawalAmountByMid,
                                    },
                                  })
                                }
                              >
                                <span>
                                  Withdrawal Amt:-{" "}
                                  {item?.approvedWithdrawalAmount}
                                </span>
                                <span>
                                  Count:-{item?.approvedWithdrawalCount}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            )}
          </div>
          <ul className="pagination  justify-content-center">
            <Stack spacing={2}>
              <Pagination
                count={totalPages}
                color="secondary"
                page={currentPage}
                onChange={(Event, New_Page) => setCurrentPage(New_Page)}
              />
            </Stack>
          </ul>
        </main>
      </div>
    </>
  );
}
export default React.memo(DepositList);
