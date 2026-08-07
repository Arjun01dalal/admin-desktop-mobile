import React, { useState, useEffect, useContext, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, MenuItem, Modal, Select } from "@mui/material";

import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import { Client_Names } from "../../../../Configuration/Enums";
import { API_Endpoint } from "../../../../Configuration/Settings";
import SearchBar from "../../../../Components/SearchBox/Search";
import { encryptData } from "../../../../utils/encryptData";
import { decryptData } from "../../../../utils/decryptData";
import { API_Handler } from "../../../../API/API_Handler";
import { fetchUserGetAll } from "../../../../API/userGetAll";
import { User_Context } from "../../../../Contexts/User";
import { dateTime, formatDate } from "../../../../utils/utility";

const KYCList = () => {
  const { User: User1 } = useContext<any>(User_Context);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [kycData, setKYCData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  );
  const [endDate, setEndDate] = useState<string>(
    new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  );

  const [searchMob, setSearchMob] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchAccNo, setSearchAccNo] = useState("");
  const [searchAadharNo, setSearchAadharNo] = useState("");
  const [appClientName, setAppClientName] = useState("");
  const [searchDpId, setSearchDpId] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");

  const getAllUserData = (options?: { force?: boolean }) => {
    let filter: Partial<{
      mobile?: string;
      name: string;
      accountNumber: string;
      aadhaarNumber: string;
      _id: string;
      clientName?: string;
    }> = {
      mobile: searchMob || undefined,
      name: searchName || undefined,
      accountNumber: searchAccNo || undefined,
      aadhaarNumber: searchAadharNo || undefined,
      clientName: appClientName || undefined,
      _id: searchDpId || undefined,
    };

    let data = {};
    if (startDate && endDate) {
      data = {
        itemsPerPage: 50,
        pageNo: 1,
        kycStartDate: dateTime(startDate),
        kycEndDate: dateTime(endDate),
        filter: filter,
      };
    } else {
      data = {
        itemsPerPage: 50,
        pageNo: 1,
        filter: filter,
      };
    }
    setLoading(true);

    fetchUserGetAll(data, { force: options?.force, token: User1.token })
      .then((result) => {
        setKYCData(result.items ?? []);
      })
      .catch((error) => {
        console.log(error);
        toast.error(error.response?.data?.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getAllUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appClientName]);

  const handleOpen = (img: string) => {
    setSelectedImage(img);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedImage("");
  };

  return (
    <>
      <div className="g-sidenav-show  bg-gray-100">
        <ToastContainer autoClose={2000} position="top-center" />
        <Sidenav />
        <main className="main-content position-relative">
          <Breadcrumbs tab="Kyc User List" />

          <div className="container-fluid mt-2">
            <div className="row">
              <div className="row tp-form mb-2">
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
                  <a
                    onClick={() => (loading ? {} : getAllUserData({ force: true }))}
                    className="sechBtn mt-1"
                  >
                    Apply
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto mt-4">
            <div className="max-w-4xl mx-auto px-4 lg:pr-10">
              <table className="table table-view">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      User
                      <br />
                      Name
                    </th>
                    <th className="px-4 py-2 text-left">
                      User
                      <br />
                      ID
                    </th>
                    <th className="px-4 py-2 text-left">IFSC</th>
                    <th className="px-4 py-2 text-left">App Name</th>
                    <th className="px-4 py-2 text-left">
                      Doc Checked
                      <br />
                      By
                    </th>
                    <th className="px-4 py-2 text-left">
                      Doc Cross
                      <br />
                      Checked By
                    </th>
                    <th
                      className="px-4 py-2 text-left"
                      style={{ width: "300px" }}
                    >
                      Note
                    </th>
                    <th className="px-4 py-2 text-left">
                      Aadhar
                      <br />
                      No
                    </th>
                    <th className="px-4 py-2 text-left">Aadhar Image</th>
                    <th className="px-4 py-2 text-left">
                      Account
                      <br />
                      No
                    </th>
                    <th className="px-4 py-2 text-left">
                      Bank
                      <br />
                      Name
                    </th>
                    <th className="px-4 py-2 text-left">
                      UPI
                      <br />
                      ID
                    </th>
                    <th className="px-4 py-2 text-left">
                      Updated
                      <br />
                      By
                    </th>
                  </tr>
                </thead>
                <thead>
                  <th className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={searchName}
                        onChange={(e: any) => setSearchName(e?.target?.value)}
                        onSearch={() => getAllUserData({ force: true })}
                        placeholder="Search by name"
                      />
                    </div>
                  </th>
                  <th className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={searchDpId}
                        onChange={(e: any) => setSearchDpId(e?.target?.value)}
                        onSearch={() => getAllUserData({ force: true })}
                        placeholder="Search by DP ID"
                      />
                    </div>
                  </th>
                  <th className="thdr"></th>
                  <th className="thdr">
                    <div className="d-flex justify-content-center">
                      <Select
                        labelId="demo-select-small-label"
                        id="demo-select-small"
                        label="Select App Name"
                        value={appClientName}
                        onChange={(e: any) =>
                          setAppClientName(e?.target?.value)
                        }
                      >
                        {Client_Names.map((appName: any, index: number) => (
                          <MenuItem key={index} value={appName}>
                            {appName}
                          </MenuItem>
                        ))}
                      </Select>
                    </div>
                  </th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={searchAadharNo}
                        onChange={(e: any) =>
                          setSearchAadharNo(e?.target?.value)
                        }
                        onSearch={() => getAllUserData({ force: true })}
                        placeholder="Search by Aadhar No"
                      />
                    </div>
                  </th>
                  <th className="thdr"></th>
                  <th className="thdr">
                    <div className="d-flex justify-content-center">
                      <SearchBar
                        value={searchAccNo}
                        onChange={(e: any) => setSearchAccNo(e?.target?.value)}
                        onSearch={() => getAllUserData({ force: true })}
                        placeholder="Search by Account No"
                      />
                    </div>
                  </th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={100}
                        style={{ textAlign: "center", padding: "10px" }}
                      >
                        <Box
                          display="flex"
                          justifyContent="center"
                          alignItems="center"
                        >
                          <CircularProgress size={25} />
                        </Box>
                      </td>
                    </tr>
                  ) : (
                    kycData?.map((item: any, index: number) => {
                      return (
                        <tr
                          key={"test_11"}
                          className="border-t hover:bg-gray-50 transition"
                        >
                          <td className="px-4 py-3">{item?.name}</td>
                          <td className="px-4 py-3">{item?._id}</td>
                          <td className="px-4 py-3">{item?.ifsc}</td>
                          <td className="px-4 py-3">{item?.clientName}</td>
                          <td className="px-4 py-3">
                            <div className="d-flex flex-column ">
                              {item?.kycDocCheckBy ? (
                                <>
                                  <span>{item?.kycDocCheckBy?.name}</span>
                                  <span>
                                    {formatDate(item?.kycDocCheckBy?.date)}
                                  </span>
                                </>
                              ) : (
                                "-"
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="d-flex flex-column ">
                              {item?.kycDocCheckBy ? (
                                <>
                                  <span>{item?.kycDocCrossCheckBy?.name}</span>
                                  <span>
                                    {formatDate(item?.kycDocCrossCheckBy?.date)}
                                  </span>
                                </>
                              ) : (
                                "-"
                              )}
                            </div>
                          </td>
                          <td
                            className="px-4 py-3"
                            style={{
                              minWidth: "300px",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                            }}
                          >
                            {item?.currentKycNote}
                          </td>
                          <td className="px-4 py-3">{item?.aadhaarNumber}</td>
                          <td
                            className="px-4 py-3"
                            onClick={() =>
                              item?.adharImageURL
                                ? handleOpen(item?.adharImageURL)
                                : {}
                            }
                          >
                            {item?.adharImageURL ? "View Aadhar Card" : "-"}
                          </td>
                          <td className="px-4 py-3">{item?.accountNumber}</td>
                          <td className="px-4 py-3">{item?.bankName}</td>
                          <td className="px-4 py-3">{item?.upiId}</td>
                          <td className="px-4 py-3">
                            <div className="d-flex flex-column ">
                              <span>
                                {item?.KycUpdatedBy
                                  ? item?.KycUpdatedBy?.name
                                  : item?.manualKycUpdatedBy?.name}
                              </span>
                              <span>
                                {item?.manualKycUpdatedBy &&
                                  formatDate(item?.manualKycUpdatedBy?.date)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      <Modal open={open} onClose={handleClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "#fff",
            boxShadow: 24,
            p: 2,
            borderRadius: 2,
            outline: "none",
          }}
        >
          <img
            src={selectedImage}
            alt="full"
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              objectFit: "contain",
            }}
          />
        </Box>
      </Modal>
    </>
  );
};

export default KYCList;
