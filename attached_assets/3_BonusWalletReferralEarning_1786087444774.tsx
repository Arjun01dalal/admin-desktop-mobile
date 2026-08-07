import React, { useState, useEffect, useContext } from "react";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";
import { User_Context } from "../../../../Contexts/User";
import axios from "axios";
import { decryptData } from "../../../../utils/decryptData";
import { useLocation } from "react-router-dom";
import { formatedTime } from "../../../../utils/utility";
import { Pagination, Stack } from "@mui/material";
import { formatDate } from "../../../../utils/utility";
import { Responsibilities } from "../../../../Configuration/Enums";

interface Data {
  pageNo: number;
  itemsPerPage: number;
  filter: {
    userId: string;
  };
  sort: {
    createdOn: number;
  };
  bonusBy?: {
    name: string;
    _id: string;
    type: string;
    transaction: string;
  };
}
function BonusWalletReferralEarning() {
  const { User } = useContext(User_Context);
  const location = useLocation();
  const customProps = location.state;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tableData, setTableData] = useState<any>([]);

  const formatedDate = (date: any) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString();
    return `${day}-${month}-${year}`;
  };
  const formattedDate = (timestamp: any) => formatedDate(new Date(timestamp));

  useEffect(() => {
    let url;
    if (customProps.Type === "bonus") {
      url = `${API_Endpoint}/bonus-wallet/getUserBonusWalletHistory`;
    } else if (["lapsedBonus", "availedBonus"]?.includes(customProps.Type)) {
      setTableData(customProps?.obj?.items);
      return;
    } else {
      url = `${API_Endpoint}/bonus-wallet/getUserBonusWalletHistoryReferral`;
    }
    let data: Data = {
      pageNo: currentPage,
      itemsPerPage: 20,
      filter: {
        userId: customProps.User_ID,
      },
      sort: {
        createdOn: -1,
      },
    };
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };
    axios
      .request(config)
      .then(async (response) => {
        response.data.data = await decryptData(response.data.data);
        setTableData(response.data.data.payload.items);
        setTotalPages(response.data.data.payload.totalPages);
      })
      .catch((error: any) => {
        console.log(error.message);
      });
  }, [currentPage]);

  return (
    <div className="g-sidenav-show  bg-gray-100">
      <Sidenav />
      <main className="main-content position-relative">
        <div style={{ background: "#f8f9fa" }}>
          <Breadcrumbs
            tab={
              customProps.Type === "bonus"
                ? "Bonus Earning Data"
                : "Bonus Referral Earning Data"
            }
          />
          <div className="container-fluid">
            <div className="row">
              <div className="col-12">
                <div className="table-responsive">
                  <table className="table table-view">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>App Name</th>
                        <th>Opening Balance</th>
                        <th>Amount</th>
                        {customProps?.Type === "lapsedBonus" && (
                          <>
                          <th>Lapsed Amount</th>
                          <th>Bonus Date</th>
                          <th>Reason</th>
                          </>
                        )}
                        <th>Closing Balance</th>
                        <th>Referred By Name</th>
                        <th>Referred By Mobile</th>
                        <th>Referred To Name</th>
                        <th>Referred To Mobile</th>
                        <th>First Deposit %</th>
                        <th>Referral %</th>
                        <th>Bonus By</th>
                        <th>Bonus Type</th>
                        <th>Remark</th>
                        <th>Created on</th>
                        {customProps?.Type !== "lapsedBonus" && (
                          <th>Updated on</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((item: any, index: number) => {
                        return (
                          <tr key={index} id={item._id}>
                            <td>{index + 1}</td>
                            <td>{item.name}</td>
                            <td>
                              {User?.data?.Responsibilities?.includes(
                                Responsibilities.show_mobile,
                              )
                                ? item.mobile
                                : "**********"}
                            </td>
                            <td>{item.clientName}</td>
                            <td>{item.bonusWalletOpenBalance}</td>
                            <td>{item.amount}</td>
                            {customProps?.Type === "lapsedBonus" && (
                              <>
                                <td>{item?.lapsedAmount}</td>
                                <td>{`${formattedDate(item?.bonusDate)} , ${formatedTime(item?.bonusDate)}`}</td>
                                <td>{item?.reason}</td>
                              </>
                            )}
                            <td>{item.bonusWalletClosingBalance}</td>
                            <td>{item.referredByName}</td>
                            <td>{item.referredByMobile}</td>
                            <td>{item.referredToName}</td>
                            <td>{item.referredToMobile}</td>
                            <td>{item.firstDepositPercentage}%</td>
                            <td>{item.referralPercentage}%</td>
                            <td>{item?.bonusBy?.name}</td>
                            <td>{item?.bonusBy?.type}</td>
                            <td>{item?.remark}</td>
                            <td>{`${formattedDate(item.createdOn)} , ${formatedTime(item.createdOn)}`}</td>
                            {customProps?.Type !== "lapsedBonus" && (
                              <td>{`${formattedDate(item.updatedOn)} , ${formatedTime(item.updatedOn)}`}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="pagination d-flex justify-content-center">
                  <Stack spacing={2}>
                    <Pagination
                      count={totalPages}
                      color="secondary"
                      page={currentPage}
                      onChange={(Event, New_Page) => setCurrentPage(New_Page)}
                    />
                  </Stack>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default BonusWalletReferralEarning;
