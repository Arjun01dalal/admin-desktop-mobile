import React, { useState, useEffect, useContext } from 'react'
import Sidenav from '../../../../Components/SideNavigation/SideNavigation'
import Breadcrumbs from '../../../../Components/Breadcrumbs/Breadcrumbs'
import axios from 'axios';
import { API_Endpoint } from '../../../../Configuration/Settings';
import { encryptData } from '../../../../utils/encryptData';
import { decryptData } from '../../../../utils/decryptData';
import { User_Context } from '../../../../Contexts/User';
import { Pagination, Stack } from "@mui/material";
import Loader from '../../../../Components/Loader/Loader';
import { useParams } from "react-router-dom";
import { formatDate, formatedTime } from '../../../../utils/utility';
import { toast } from 'react-toastify';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';



interface BonusHistory {
    name: string;
    mobile?: string;
    amount: number;
    bonusWalletOpenBalance: number;
    bonusWalletClosingBalance: number;
    updatedOn: string;
    type: string;
    referredByName: string;
    referredByMobile: string;
    referredToName: string;
    referredToMobile: string;
}

function BonusWalletHistory() {
    const { User } = useContext(User_Context)
    const [loading, setLoading] = useState<boolean>(false);
    const [bonusHistoryData, setBonusHistoryData] = useState<BonusHistory[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const { userId } = useParams();
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);

    useEffect(() => {
        setLoading(true)
        let data = {
            itemsPerPage: itemsPerPage,
            pageNo: currentPage,
            filter: {
                userId: userId
            }
        }
        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${API_Endpoint}/bonus-wallet/getUserBonusWalletHistoryReferral`,
            headers: {
                Authorization: `Bearer ${User.token}`,
            },
            data: { token: encryptData(data) },
        };
        axios
            .request(config)
            .then(async(response) => {
                response.data.data = await decryptData(response.data.data)
                setTotalPages(response.data.data.payload.totalPages)
                setBonusHistoryData(response.data.data.payload.items)
                setLoading(false)
            })
            .catch((error: any) => {
                console.log(error.message);
                setLoading(false)
            });
    }, [currentPage])

    // copty mobile
    const copyMobile = async (textToCopy: any) => {
        try {
            await navigator.clipboard.writeText(textToCopy);
            toast.success(`${textToCopy} Coppied`)
        } catch (err) {
            console.log(err)
        }
    }

    return (
        <>
            {loading ? (<Loader />) : (
                <div className="g-sidenav-show  bg-gray-100">
                    <Sidenav />
                    <main className="main-content position-relative">
                        <div style={{ background: "#f8f9fa" }}>
                            <Breadcrumbs tab={"Bonus Wallet History"} />
                            <div className="container-fluid">
                                <div className="row">
                                    <div className="col-12 mt-1">
                                        <div className="table-responsive">
                                            <table className="table table-view">
                                                <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th>User Name</th>
                                                        <th>Mobile</th>
                                                        <th>Type</th>
                                                        <th>Opening Balance</th>
                                                        <th>Amount</th>
                                                        <th>Closing Balance</th>
                                                        <th>Referred By Name</th>
                                                        <th>Referred By Mobile</th>
                                                        <th>Referred To Name</th>
                                                        <th>Referred To Mobile</th>
                                                        <th>Date</th>
                                                        <th>Time</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bonusHistoryData.map((item, index) => (
                                                        <tr>
                                                            <td>{index + 1 + (currentPage && itemsPerPage ? (currentPage - 1) * itemsPerPage : 0)}</td>
                                                            <td>{item.name}</td>
                                                            <td>
                                                                {`****** ${item?.mobile?.slice(-4)}`}
                                                                <ContentCopyIcon onClick={() => copyMobile(item?.mobile)}
                                                                    style={{ color: "#333", fontSize: '17px', marginLeft: "10px", cursor: "pointer" }} />
                                                                    </td>
                                                            <td>{item.type === "userFirstDepositBonus" ? "Bonus for user first deposit" : item.type === "userBonusOtherDeposit" ? "Bonus for user on deposit amount" : item.type === "referralFirstDeposit" ? "Bonus for referral" : item.type === "referralOtherDeposit" ? "Bonus for user by referred user deposit" : ""}</td>
                                                            <td>{item.bonusWalletOpenBalance}</td>
                                                            <td>{item.amount}</td>
                                                            <td>{item.bonusWalletClosingBalance}</td>
                                                            <td>{item.referredByName}</td>
                                                            <td>{item.referredByMobile}</td>
                                                            <td>{item.referredToName}</td>
                                                            <td>{item.referredToMobile}</td>
                                                            <td>{formatDate(item.updatedOn)}</td>
                                                            <td>{formatedTime(item.updatedOn)}</td>
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
                </div>)}
        </>
    )
}

export default BonusWalletHistory