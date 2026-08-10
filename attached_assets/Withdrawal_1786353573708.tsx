import React, {
  useContext,
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
} from "react";
import "../../../../Css/style.css";
import "../../../../Css/table.css";
import "../../../../Css/users.css";
import "./Withdrawal.css";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Button from "@mui/material/Button";
import axios from "axios";
import {
  // allowedStatus, // used by commented approved-deposit-withdrawal-report flow
  dateTime,
  formatAmount,
  formatedTime,
  gatewayData,
  manualGatewayData,
} from "../../../../utils/utility";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../../../../Components/Loader/Loader";
import { API_Endpoint } from "../../../../Configuration/Settings";
import {
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  Stack,
} from "@mui/material";
import {
  faSquareCheck,
  faRectangleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { User_Context } from "../../../../Contexts/User";
import { decryptData } from "../../../../utils/decryptData";
import { encryptData } from "../../../../utils/encryptData";
import CustomSelect from "../../../../Components/Dropdown/CustomSelect";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import SearchBar from "../../../../Components/SearchBox/Search";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import {
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
} from "@material-ui/core";
import Reusable_Input from "../../../../Components/InputField/InputField";
import ExcelExport from "../../../../Excel/ExcelExport";
import {
  Client_Names,
  Responsibilities,
  Withdraw_Delay_Reasons,
} from "../../../../Configuration/Enums";
import { useNavigationType } from "react-router-dom";
import Checkbox from "@mui/material/Checkbox";
import { error } from "console";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import useLocation from "../../../../Hooks/useLocation";
import { config } from "process";
import { API_Handler } from "../../../../API/API_Handler";
import UpiQr from "./UPIQR";
import ValidationModal from "./ValidationModal";
import SearchIcon from "@mui/icons-material/Search";
import BeneModal from "./BeneModal";
import AddBenePopup from "./AddBenePopup";
import BeneficiarySelect from "./BeneficiarySelect";
import {
  extractBeneficiaryAccounts,
} from "./beneficiaryUtils";

interface Withdraw {
  playedGames: [];
  clientName: string;
  secondRejectUserName: string;
  pnl: number;
  afterWithdrawalPnl: number;
  secondReject: boolean;
  firstReject: boolean;
  accountHolderName: string;
  commissionAmount: string;
  _id: string;
  userId: string;
  amount: number;
  orderId: string;
  city: string;
  state: String;
  lock: string;
  userBankName: string;
  status: string;
  type: string;
  createdOn: string;
  updatedOn: string;
  __v: number;
  updatedData?: any;
  txid: string;
  paymentGatewayName: string;
  bankName: string;
  ifscCode: string;
  mobile: string;
  accountNo: string;
  transactionId: string;
  secondCheck: boolean;
  firstCheck: boolean;
  firstCheckUserName: string;
  secondCheckUserName: string;
  firstRejectUserName: string;
  dp_id: string;
  withdrewalProviderName: string;
  mid: string;
  checkBy: {
    name: string;
    userId: string;
    status: boolean;
    _id: string;
    date: string;
  };
  crossCheckBy: {
    name: string;
    userId: string;
    status: boolean;
    _id: string;
    date: string;
  };
  action: {
    name: string;
    userId: string;
    status: boolean;
    _id: string;
  };
}

interface WithdrawData {
  todaysTotalApprovedAmount: number;
  todaysTotalApprovedCount: number;
  previousTotalApprovedAmount: number;
  previousTotalApprovedCount: number;
  totalApprovedAmount: number;
  totalApprovedCount: number;
  totalCanceledAmount: number;
  totalCanceledCount: number;
  totalRejectedAmount: number;
  totalRejectedCount: number;
  totalReversedAmount: number;
  totalReversedCount: number;
  totalPendingAmount: number;
  totalPendingCount: number;
  totalOnholdAmount: number;
  totalOnholdCount: number;
}

function Withdraw() {
  const [isAscending, setIsAscending] = useState(true);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [endDate, setEndDate] = useState<string>(
    new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  );
  const [withdrawData, setWithdrawData] = useState<Array<Withdraw>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { User } = useContext(User_Context);
  const Number_of_Items_per_Page = 10;
  const locationInfo = useLocation();
  const [address, setAddress] = useState<any>({});
  const [midArray, setMidArray] = useState<any>([]);
  const [BeneAccArray, setBeneAccArray] = useState<any>([]);
  const [openCreateBene, setOpenCreateBene] = useState(false);

  const Local_Role = localStorage.getItem("role");
  const Filtered_Client_Names: any =
    Local_Role == "cheacker" || Local_Role == "user_coin"
      ? Client_Names
      : User.data?.clientName
        ? User.data.clientName
        : User.data?.allotedApps
          ? User.data.allotedApps
          : Client_Names;
  const navType = useNavigationType();
  const key = `page_withdrawal`;

  useEffect(() => {
    const savedPage = sessionStorage.getItem(key);

    if (navType === "POP") {
      if (savedPage) {
        setCurrentPage(Number(savedPage));
      }
    } else {
      setCurrentPage(1);
    }
  }, []);

  const toggleSort = () => {
    const sorted = [...withdrawData].sort((a, b) =>
      isAscending ? a?.amount - b?.amount : b?.amount - a?.amount,
    );

    setWithdrawData(sorted);
    setIsAscending(!isAscending);
  };

  // get latitude and longitude
  const getAddress = async () => {
    if (!(locationInfo?.coords?.latitude && locationInfo?.coords.longitude)) {
      locationInfo?.requestLocation();
      return;
    } else {
      let payload = {
        lat: locationInfo?.coords?.latitude,
        lng: locationInfo?.coords?.longitude,
      };
      let token = localStorage.getItem("token");
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/transaction/getAddress`,
        data: { token: encryptData(payload) },
        headers: { Authorization: `Bearer ${token}` },
      };
      await API_Handler.request(config)
        .then(async (response) => {
          let API_Response = await decryptData(response?.data?.data);
          API_Response.payload.city = API_Response?.payload?.city || "Jabalpur";
          API_Response.payload.state =
            API_Response?.payload?.state || "Madhya Pradesh";
          setAddress(API_Response?.payload);
          console.log("Address=====>", API_Response);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  useEffect(() => {
    if (!(locationInfo?.coords?.latitude && locationInfo?.coords.longitude)) {
      locationInfo?.requestLocation();
    } else {
      getAddress();
      console.log(locationInfo.coords.latitude);
      console.log(locationInfo.coords.longitude);
    }
  }, [locationInfo?.coords?.latitude, locationInfo?.coords?.longitude]);

  const [searchUserName, setSearchUserName] = useState<string>(() => {
    const savedData = localStorage.getItem("userName");
    return savedData ? savedData : "";
  });

  const [searchUserStatus, setSearchUserStatus] = useState<string>(() => {
    const savedData = localStorage.getItem("userStatus");
    return savedData ? savedData : "";
  });
  const [searchUserMobileNo, setSearchUserMobileNo] = useState<string>(() => {
    const savedData = localStorage.getItem("userMob");
    return savedData ? savedData : "";
  });
  const [searchUserIfsc, setSearchUserIfsc] = useState<string>(() => {
    const savedData = localStorage.getItem("userIfsc");
    return savedData ? savedData : "";
  });
  const [searchUserAccountNo, setSearchUserAccountNo] = useState<string>(() => {
    const savedData = localStorage.getItem("userAccountNo");
    return savedData ? savedData : "";
  });
  const [searchUserAmount, setSearchUserAmount] = useState<string>(() => {
    const savedData = localStorage.getItem("userAmount");
    return savedData ? savedData : "";
  });
  const [searchUserDpId, setSearchUserDpId] = useState<string>(() => {
    const savedData = localStorage.getItem("userDpId");
    return savedData ? savedData : "";
  });
  const [searchUserTransactionId, setSearchUserTransactionId] =
    useState<string>(() => {
      const savedData = localStorage.getItem("userTransactionId");
      return savedData ? savedData : "";
    });
  const [Payment_Gateways, Set_Payment_Gateways] = useState<string[]>([]);
  const [
    Selected_Payment_Gateway_Indexes,
    Set_Selected_Payment_Gateway_Indexes,
  ] = useState<number[]>(new Array(Number_of_Items_per_Page).fill(0));
  let withdrawl = "withdrawal";
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const savedItemsPerPage = localStorage.getItem("itemsPerPage");
    return savedItemsPerPage ? parseInt(savedItemsPerPage, 10) : 10;
  });
  const [totalUser, setTotalUser] = useState<number>(10);
  const [openPopup, setOpenPopup] = useState<boolean>(false);
  const [openValidationModal, setOpenValidationModal] =
    useState<boolean>(false);
  const [validationData, setValidationData] = useState<any>([]);
  const [remark, setRemark] = useState<string>("");
  const [remarkError, setRemarkError] = useState<boolean>(false);
  const [remarkHelperText, setRemarkHelpertext] = useState<string>("");
  const [beneNameError, setBeneNameError] = useState<boolean>(false);
  const [beneNameHelperText, setBeneNameHelpertext] = useState<string>("");
  const [orderIdPopup, setOrderIdPopup] = useState<string>("");
  const [actionPopup, setActionPopup] = useState<string>("");
  const [dpIdPopup, setDpIdPopup] = useState<string>("");
  const [paymentGateway, setPaymentGateway] = useState<string>("");
  const [withdrawalProviderName, setWithdrawalProviderName] =
    useState<string>("");
    const [beneAccName, setBeneAccName] =
    useState<string>("");
  const [preferredwithdrawalProviderName, setPreferredWithdrawalProviderName] =
    useState<string>("");
  const [fetchAllData, setFetchAllData] = useState<string>("");
  const [showQRPopup, setShowQRPopup] = useState<boolean>(false);
  const [showAddBenePopup, setShowAddBenePopup] = useState<boolean>(false);
  const [beneName, setBeneName] = useState<string[]>([]);
  const [beneficiaryAccounts, setBeneficiaryAccounts] = useState<string[]>([]);
  const [bulkManualApprovePopup, setBulkManualApprovePopup] =
    useState<boolean>(false);
  const [QRCodeData, setQRCodeData] = useState<any>({});
  const [totalWithdrawData, setTotalWithdrawData] = useState<{
    [key: string]: WithdrawData;
  }>({});
  const [fundId, setFundId] = useState<string>("");
  const [selectedWithdrawDelayReason, setSelectedWithdrawDelayReason] =
    useState("");
  const [sortChecked, setSordChecked] = useState(false);
  const [gatewayName, setGatewayName] = useState<any>("");
  const [selectMidName, setSelectMidName] = useState<any>("");
  const [searchWithdrawUserCity, setSearchWithdrawUserCity] = useState<string>(
    () => {
      const savedData = localStorage.getItem("userCity");
      return savedData ? savedData : "";
    },
  );
  const [searchWithdrawUserState, setSearchWithdrawUserState] =
    useState<string>(() => {
      const savedData = localStorage.getItem("userState");
      return savedData ? savedData : "";
    });
  const [appClientName, setAppClientName] = useState<string>(() => {
    const savedData = localStorage.getItem("appName");
    return savedData ? savedData : "";
  });
  const [searchWinInStatus, setSearchWinInStatus] = useState<string>(() => {
    const savedData = localStorage.getItem("userWinIn");
    return savedData ? savedData : "";
  });
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [bankAmt, setBankAmt] = useState("");

  const Handle_App_Client_Name = (event: SelectChangeEvent<string>) => {
    setAppClientName(event.target.value);
    console.log("app client name", event.target.value);
    localStorage.setItem("appName", event.target.value);
  };

  const handleSearchUserName = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserName(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("userName", event.target.value);
  };

  const handleSearchUserMob = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserMobileNo(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("userMob", event.target.value);
  };

  const handleSearchUserIfsc = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserIfsc(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("userIfsc", event.target.value);
  };

  const handleSearchUserAmount = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserAmount(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("userAmount", event.target.value);
  };

  const handleSearchUserTransactionId = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setSearchUserTransactionId(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("userTransactionId", event.target.value);
  };

  const handleSearchUserDpId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserDpId(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("userDpId", event.target.value);
  };

  const handleSearchUserAccountNo = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserAccountNo(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("userAccountNo", event.target.value);
  };

  const handleWithdrawSearchCity = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchWithdrawUserCity(event.target.value);
    localStorage.setItem("userCity", event.target.value);
  };

  const handleWithdrawSearchState = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchWithdrawUserState(event.target.value);
    localStorage.setItem("userState", event.target.value);
  };

  useEffect(() => {
    API_Handler.request({
      method: "post",
      url: `${API_Endpoint}/payoutAccounts/getAll-active`,
      headers: { Authorization: `Bearer ${User.token}` },
      data: { token: encryptData({}) },
    })
      .then(async (response) => {
        response.data.data = await decryptData(response.data.data);
        setPaymentGateway(response.data.data.payload[0].name);
        Set_Payment_Gateways(
          response.data.data.payload?.map(
            (Payment_Gateway: any) => Payment_Gateway.name,
          ),
        );
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  const getFundRequests = () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    let data = {};
    if (startDate && endDate) {
      data = {
        startDate: dateTime(startDate),
        endDate: dateTime(endDate),
      };
    } else if (fundId === "alldata") {
      data = {};
    } else {
      //   const currentDate = new Date().toISOString().split('T')[0];
      const currentDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      data = {
        startDate: dateTime(currentDate),
        endDate: dateTime(currentDate),
      };
    }
    if (token) {
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/SubAdmin/fund-request`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { token: encryptData(data) },
      };

      axios
        .request(config)
        .then(async (response) => {
          response.data.data = await decryptData(response.data.data);
          setTotalWithdrawData(response.data.data.payload.WithdrawalData);
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
  };

  useEffect(() => {}, [withdrawData]);

  const handlePerPage = (newValue: any) => {
    setItemsPerPage(newValue);
    localStorage.setItem("itemsPerPage", newValue);
  };

  const filterTransactionData = (e: any) => {
    const id = e.target.id;
    setFundId(id);
    if (id === "alldata") {
      setStartDate("");
      setEndDate("");
      setCurrentPage(1);
      setFetchAllData("test");
      getFundRequests();
    } else {
      setFetchAllData("");
      filterTransaction();
      setCurrentPage(1);
      getFundRequests();
    }
  };

  // Commented out: approved-deposit-withdrawal-report enrichment
  // const fetchTopMidReport = async (userId: string) => {
  //   const token = localStorage.getItem("token");

  //   const payload: any = {
  //     itemsPerPage: 10,
  //     pageNo: 1,
  //     filter: {
  //       name: "",
  //       mobile: "",
  //       city: "",
  //       state: "",
  //       userId: userId || "",
  //       clientName: "",
  //       mid: preferredwithdrawalProviderName,
  //     },
  //   };

  //   if (startDate && endDate) {
  //     payload.startDate = startDate;
  //     payload.endDate = endDate;
  //   }
  //   const config = {
  //     method: "post",
  //     url: `${API_Endpoint}/transaction/approved-deposit-withdrawal-report`,
  //     headers: { Authorization: `Bearer ${token}` },
  //     data: { token: encryptData(payload) },
  //   };

  //   const res = await axios.request(config);
  //   const decrypted = await decryptData(res.data.data);
  //   return decrypted?.payload?.items?.[0];
  // };

  // const mergeTopMidData = (items: any, report: any) => {
  //   const deposit = report?.top5MidDeposit || [];
  //   const withdrawal = report?.top5MidWithdrawal || [];

  //   const updatedData = deposit?.map((depositItem: any) => {
  //     const matchedWithdrawal = withdrawal?.find(
  //       (w: any) => w.mid === depositItem.mid,
  //     );

  //     return {
  //       mid: depositItem.mid,
  //       depositAmount: depositItem.amount,
  //       depositCount: depositItem.count,
  //       withdrawalAmount: matchedWithdrawal ? matchedWithdrawal.amount : 0,
  //       withdrawalCount: matchedWithdrawal ? matchedWithdrawal.count : 0,
  //       showRecord:
  //         (depositItem?.amount || 0) -
  //           (matchedWithdrawal ? matchedWithdrawal.amount : 0) >=
  //         (items?.amount || 0),
  //     };
  //   });
  //   return {
  //     ...items,
  //     updatedData,
  //     showLockBtn:
  //       preferredwithdrawalProviderName === "yesbank-astro-trpl"
  //         ? (updatedData?.[0]?.depositAmount || 0) -
  //             (updatedData?.[0]?.withdrawalAmount || 0) -
  //             (report?.inProgressWithdrawalAmount || 0) >=
  //           (items?.amount || 0)
  //         : true,
  //     inProgressWithdrawalAmount: report?.inProgressWithdrawalAmount,
  //     pendingWithdrawalAmount: report?.pendingWithdrawalAmount,
  //   };
  // };

  // const processItemsByStatus = async (items: any[]) => {
  //   const token = localStorage.getItem("token");

  //   const processed = await Promise.all(
  //     items.map(async (item: any) => {
  //       const isAllowed = allowedStatus.includes(item.status);

  //       if (isAllowed) return item;
  //       //not allowed → call second API for THIS item
  //       const report = await fetchTopMidReport(item?.dp_id);

  //       const merged = mergeTopMidData(item, report);
  //       console.log("merged:::", merged);

  //       return merged;
  //     }),
  //   );

  //   return processed;
  // };

  const filterTransaction = (event?: any, page?: number) => {
    const id = event?.currentTarget?.id;
    setLoading(true);
    let filter: {
      mobile?: string;
      city?: string;
      state?: string;
      status?: string;
      ifscCode?: string;
      accountNo?: string;
      dp_id?: string;
      accountHolderName?: string;
      amount?: string;
      transactionId?: string;
      clientName?: string;
      playedGames?: string;
      sort?: boolean;
      app?: string;
      min?: any;
      max?: any;
      bankAmt?: any;
      beneficiaryAccount?: any;
      withdrewalProviderName?: any;
      mid?: any;
      name?:string;
    } = {};
    if (searchUserName) {
      filter.accountHolderName = searchUserName;
    }
    if (min) {
      filter.min = min;
    }
    if (max) {
      filter.max = max;
    }
    if (bankAmt) {
      filter.bankAmt = bankAmt;
    }
    if(beneAccName) {
      filter.beneficiaryAccount = beneAccName;
    }
    if (searchUserAmount) {
      filter.amount = searchUserAmount;
    }
    if (searchUserTransactionId) {
      filter.transactionId = searchUserTransactionId;
    }
    if (searchUserDpId) {
      filter.dp_id = searchUserDpId;
    }
    if (searchUserAccountNo) {
      filter.accountNo = searchUserAccountNo;
    }
    if (searchUserIfsc) {
      filter.ifscCode = searchUserIfsc;
    }
    if (searchUserMobileNo) {
      filter.mobile = searchUserMobileNo;
    }
    if (searchWithdrawUserCity) {
      filter.city = searchWithdrawUserCity;
    }
    if (searchWithdrawUserState) {
      filter.state = searchWithdrawUserState;
    }
    if (appClientName) {
      filter.clientName = appClientName;
    }
    if (sortChecked) {
      filter.sort = sortChecked;
    }
    if (withdrawalProviderName) {
      filter.mid = withdrawalProviderName;
    }
    // if (event?.target?.value == 'All') {
    // 	setSearchUserStatus('All')
    // 	filter = {}
    // } else {
    // 	setSearchUserStatus(event?.target?.value);
    // 	filter.status = event?.target?.value
    // }
    if (searchUserStatus) {
      filter.status = searchUserStatus;
    }
    // IN PROGRESS: without show_all_withdrawal, only show rows locked by me
    if (
      searchUserStatus === "IN PROGRESS" &&
      !User?.data?.Responsibilities?.includes(
        Responsibilities.show_all_withdrawal,
      )
    ) {
      filter.name = User?.data?.name;
    }
    if (searchWinInStatus) {
      if (searchWinInStatus === "All") {
        delete filter.playedGames;
      } else {
        filter.playedGames = searchWinInStatus;
      }
    }
    const token = localStorage.getItem("token");
    let data: any = {};
    if (fetchAllData) {
      data = {
        type: withdrawl,
        itemsPerPage: itemsPerPage,
        pageNo: page || currentPage,
        filter: filter,
      };
    } else if (startDate && endDate) {
      data = {
        type: withdrawl,
        itemsPerPage: itemsPerPage,
        pageNo: page || currentPage,
        filter: filter,
        startDate: dateTime(startDate),
        endDate: dateTime(endDate),
      };
    } else {
      // const currentDate = new Date().toISOString().split('T')[0];
      const currentDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      data = {
        type: withdrawl,
        itemsPerPage: itemsPerPage,
        pageNo: page || currentPage,
        filter: filter,
        startDate: dateTime(currentDate),
        endDate: dateTime(currentDate),
        // app:User?.data?.allotedApps
      };
    }

    if (
      (User.data.clientName || User.data?.allotedApps) &&
      Local_Role !== "user_coin" &&
      Local_Role !== "cheacker"
    ) {
      data.app = User.data.clientName || User.data?.allotedApps;
    } else if (Local_Role == "user_coin" || Local_Role == "cheacker") {
      data.app = Client_Names;
    }

    console.log("payload from withdrowals", data);
    if (token) {
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/transaction/getAllTransaction`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { token: encryptData(data) },
      };
      axios
        .request(config)
        .then(async (response) => {
          response.data.data = await decryptData(response.data.data);
          console.log("withdrowal data", response.data.data);

          setTotalUser(response.data.data.payload.total);
          let data = response.data.data.payload.items.length <= 0;
          if (data) {
            toast("No withdrawals available for todays date");
          }

          // Commented out: approved-deposit-withdrawal-report enrichment
          // const processedItems = await processItemsByStatus(
          //   response.data.data.payload.items,
          // );
          // setWithdrawData(processedItems);
          setWithdrawData(response.data.data.payload.items);
          setTotalPages(response.data.data.payload.totalPages);
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    filterTransaction();
    getFundRequests();
  }, [
    currentPage,
    itemsPerPage,
    fetchAllData,
    searchUserStatus,
    searchWinInStatus,
    searchWithdrawUserState,
    appClientName,
    withdrawalProviderName,
    preferredwithdrawalProviderName,
    beneAccName,
  ]);

  const handleOpenPopUp = (
    orderId?: string,
    action?: string,
    dp_id?: string,
  ) => {
    setOpenPopup(true);
    setOrderIdPopup(orderId ? orderId : "");
    setActionPopup(action ? action : "");
    setDpIdPopup(dp_id ? dp_id : "");
  };

  const handleQRCodeData = (details: any) => {
    setShowQRPopup(true);
    setQRCodeData(details);
    setOrderIdPopup(details?.transactionId);
    setActionPopup("Approved");
    setRemark("By UPI ID");
    setDpIdPopup(details?.dp_id);
  };

  const handleBeneClick = (details: any) => {
    setShowAddBenePopup(true);
    setOrderIdPopup(details?.transactionId);
    setDpIdPopup(details?.dp_id);
    setBeneficiaryAccounts(extractBeneficiaryAccounts(details));
    setBeneName([]);
  };

  const checkedBy = (itemId: string, check: string, status: boolean) => {
    if (
      locationInfo?.coords?.latitude &&
      locationInfo?.coords?.longitude &&
      address?.state &&
      address?.city
    ) {
      // Save the current page before making the API call
      const currentPageBeforeUpdate = currentPage;

      let data = {
        transactionId: itemId,
        check: check,
        updatedBy: {
          name: User.data.name,
          userId: User.data._id,
          status: status?.toString(),
          city: address?.city,
          state: address?.state,
          lat: locationInfo?.coords?.latitude?.toString(),
          long: locationInfo?.coords?.longitude?.toString(),
        },
      };
      const token = localStorage.getItem("token");
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/transaction/check-withdrawal`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: { token: encryptData(data) },
      };

      axios
        .request(config)
        .then((response) => {
          if (response.data.success === true) {
            // Call filterTransaction with the saved page number
            setCurrentPage(currentPageBeforeUpdate);
            filterTransaction(undefined, currentPage);
          }
        })
        .catch((error) => {
          toast.error(error?.response?.data?.message);
          console.log(error);
        });
    } else {
      toast.error("Location Information Missing");
      locationInfo?.requestLocation();
      getAddress();
    }
  };

  const Change_Payment_Gateway = (
    Index_of_Selected_Payment_Gateway: number,
    Index: number,
  ) => {
    setPaymentGateway(Payment_Gateways[Index_of_Selected_Payment_Gateway]);
    const Copy_of_Selected_Payment_Gateway_Indexes: number[] = [
      ...Selected_Payment_Gateway_Indexes,
    ];
    Copy_of_Selected_Payment_Gateway_Indexes[Index] =
      Index_of_Selected_Payment_Gateway;
    Set_Selected_Payment_Gateway_Indexes(
      Copy_of_Selected_Payment_Gateway_Indexes,
    );
  };

  const handleUpdateBeneName = async () => {
    if (!beneName.length) {
      alert("Please select at least one bank");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const addBenePayload = {
        userId: dpIdPopup,
        bankAccountName: beneName,
      };

      const addBeneResponse = await axios.post(
        `${API_Endpoint}/User/add-beneficiary-account`,
        {
          token: encryptData(addBenePayload),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (addBeneResponse?.data?.success) {
        const syncPayload = {
          transactionId: orderIdPopup,
        };

        await axios.post(
          `${API_Endpoint}/transaction/sync-withdrawal-beneficiary-accounts`,
          { token: encryptData(syncPayload) },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
      toast.success("Beneficiary Updated Successfully");
      setShowAddBenePopup(false);
      setBeneName([]);
      setOrderIdPopup("");
      setDpIdPopup("");
      setBeneficiaryAccounts([]);

      filterTransaction();
    } catch (error: any) {
      console.log(error);

      toast.error(
        `${error?.response?.status || ""} ${
          error?.response?.statusText || "Something went wrong"
        }`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!["Approved", "Reverse"]?.includes(actionPopup) && gatewayName === "") {
      alert("Gateway Name is not empty.");
      return;
    }
    if (
      !["Approved", "Reverse"]?.includes(actionPopup) &&
      selectMidName === ""
    ) {
      alert("Mid Name is not empty.");
      return;
    }
    if (
      locationInfo?.coords?.latitude &&
      locationInfo?.coords?.longitude &&
      address?.state &&
      address?.city
    ) {
      setLoading(true);
      let data: any = {
        withdrewalProviderName:
          actionPopup === "Manual Approved" || showQRPopup
            ? gatewayName
            : paymentGateway,
        transactionId: orderIdPopup,
        reason: showQRPopup
          ? remark
          : actionPopup === "Approved"
            ? "Approved"
            : remark,
        dp_id: dpIdPopup,
        updatedBy: {
          name: User.data.name,
          _id: User.data._id,
          status: actionPopup,
          city: address?.city,
          state: address?.state,
          lat: locationInfo?.coords?.latitude?.toString(),
          long: locationInfo?.coords?.longitude?.toString(),
        },
      };
      if (selectMidName !== "") {
        data.mid = selectMidName;
      }
      if (gatewayName !== "") {
        data.gatewayName = gatewayName;
      }
      console.log("data::815", data);

      const token = localStorage.getItem("token");
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/transaction/withdrawal-status-update`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { token: encryptData(data) },
      };

      axios
        .request(config)
        .then(() => {
          setLoading(false);
          setOpenPopup(false);
          setRemark("");
          setGatewayName("");
          setSelectMidName("");
          filterTransaction();
        })
        .catch((error) => {
          console.log(error);
          toast(`${error.response.status} ${error.response.statusText}`);
          setLoading(false);
          setOpenPopup(false);
        });
    } else {
      toast.error("Location Information Missing");
      locationInfo?.requestLocation();
      getAddress();
      setLoading(false);
      return;
    }
  };

  const handleRemark = (e: ChangeEvent<HTMLInputElement>) => {
    setRemarkError(false);
    setRemark(e.target.value);
  };

  const handleBeneName = (bank: string) => {
    setBeneNameError(false);
    setBeneName((prev) =>
      prev.includes(bank) ? prev.filter((name) => name !== bank) : [...prev, bank],
    );
  };

  const handleCloseAddBenePopup = () => {
    setShowAddBenePopup(false);
    setBeneName([]);
    setBeneficiaryAccounts([]);
    setBeneNameError(false);
    setBeneNameHelpertext("");
  };

  const handleBeneficiaryRemoved = async () => {
    await getBeneAccList();
    filterTransaction();
  };

  const clearDate = () => {
    setStartDate("");
    setEndDate("");
  };

  const handleSelect = (event: any) => {
    setSearchUserStatus(event.target.value);
    localStorage.setItem("userStatus", event.target.value);
  };

  const handleWinIn = (event: any) => {
    setSearchWinInStatus(event.target.value);
    localStorage.setItem("userWinIn", event.target.value);
  };

  let allowedFields = [
    "accountHolderName",
    "accountNo",
    "afterWithdrawalPnl",
    "amount",
    "bankName",
    "city",
    "commissionAmount",
    "dp_id",
    "ifscCode",
    "mid",
    "mobile",
    "orderId",
    "pnl",
    "state",
    "status",
    "transactionId",
    "userBankName",
    "withdrewalProviderName",
    "_id",
    "createdOn",
    "updatedOn",
  ];

  // if (User.data.mobile === "8740046022") {
  //   allowedFields = allowedFields.filter((field) => field !== "mobile");
  // }
  if (User.data.mobile === "8740046022") {
    allowedFields = allowedFields.filter((field) => field !== "mobile");
  } else if (User.data.mobile === "9860126544") {
    allowedFields = [
      "dp_id",
      "amount",
      "city",
      "state",
      "transactionId",
      "userBankName",
      "withdrewalProviderName",
      "createdOn",
    ];
  }
  const headings = [
    Object.keys(withdrawData[0] || {}).filter((key) =>
      allowedFields.includes(key),
    ),
  ];
  let filteredWithdrawData = withdrawData;
  if (User.data.mobile === "9860126544") {
    // For this mobile number, show only approved status data
    filteredWithdrawData = withdrawData.filter(
      (item) => item.status === "Approved",
    );
  }

  const transformedData = withdrawData.map((item) => {
    const filteredItem = Object.keys(item)
      .filter((key) => allowedFields.includes(key))
      .reduce(
        (obj, key) => {
          obj[key] = (item as Record<string, any>)[key];
          return obj;
        },
        {} as Record<string, any>,
      );
    if (filteredItem.createdOn) {
      const date = new Date(filteredItem.createdOn as string);
      filteredItem.createdDate = date.toLocaleDateString();
      filteredItem.createdTime = date.toLocaleTimeString();
    }
    return filteredItem;
  });

  type Cities = {
    [key: string]: []; // Index signature allows any string key
  };

  const [cities, setCities] = useState<Cities>({});
  const [states, setStates] = useState([]);
  const [cityByStates, setCityByStates] = useState([]);

  useEffect(() => {
    const getCityStates = async () => {
      let token = localStorage.getItem("token");

      await API_Handler.post(
        `${API_Endpoint}/transaction/country`,
        { token: encryptData({}) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            maxBodyLength: Infinity,
          },
        },
      )
        .then(async (response) => {
          let res = await decryptData(response.data.data);
          setCities(res.payload[0].cities[0]);
          setStates(res.payload[0].states);
        })
        .catch((error) => {
          console.log(error);
        });
    };
    getCityStates();
  }, []);

  // handle lock user withdraw request-------------------
  const handleLock = async (tId: any) => {
    setLoading(true);
    let token = localStorage.getItem("token");

    let data = {
      transactionId: tId,
      updatedBy: {
        name: User.data.name,
        userId: User.data._id,
        status: "true",
        date: new Date().toISOString(),
        city: address?.city,
        state: address?.state,
        lat: locationInfo?.coords?.latitude?.toString(),
        long: locationInfo?.coords?.longitude?.toString(),
      },
    };

    await API_Handler.post(
      `${API_Endpoint}/transaction/update-withdrawal-status`,
      { token: encryptData(data) },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          maxBodyLength: Infinity,
        },
      },
    )
      .then((response) => {
        setLoading(false);
        filterTransaction();
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
      });
  };

  // handle lock user withdraw request-------------------
  const handleunLock = async (tId: any) => {
    setLoading(true);
    let token = localStorage.getItem("token");

    let data = { transactionId: tId };
    await API_Handler.post(
      `${API_Endpoint}/transaction/update-withdrawal-unlock`,
      { token: encryptData(data) },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          maxBodyLength: Infinity,
        },
      },
    )
      .then((response) => {
        setLoading(false);
        filterTransaction();
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
      });
  };

  // clear all filters
  const clearFilters = () => {
    localStorage.removeItem("userName");
    localStorage.removeItem("appName");
    localStorage.removeItem("userWinIn");
    localStorage.removeItem("userMob");
    localStorage.removeItem("userStatus");
    localStorage.removeItem("userCity");
    localStorage.removeItem("userState");
    localStorage.removeItem("userAmount");
    localStorage.removeItem("userIfsc");
    localStorage.removeItem("userTransactionId");
    localStorage.removeItem("userAccountNo");
    localStorage.removeItem("userDpId");
    localStorage.removeItem("itemsPerPage");
    window.location.reload();
  };

  const [checkedBulkApproveIds, setCheckedBulkApproveIds] = useState<{
    [key: string]: {
      transactionId: number;
      updatedBy: { name: string; status: string };
    };
  }>({});
  const [checkedBulkManualApproveIds, setCheckedBulkManualApproveIds] =
    useState<{
      [key: string]: {
        transactionId: number;
        updatedBy: { name: string; status: string; _id: string };
      };
    }>({});
  const [checkedLockIds, setCheckLockIds] = useState<any>([]);
  const [checkedUnLockIds, setCheckUnLockIds] = useState<any>([]);

  const handleBulkUnLockCheckIds =
    (id: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setCheckUnLockIds(
        (prev: number[]) =>
          event.target.checked
            ? [...prev, id] // Add ID when checked
            : prev.filter((item) => item !== id), // Remove ID when unchecked
      );
    };

  const handleBulkLockCheckIds =
    (id: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setCheckLockIds(
        (prev: number[]) =>
          event.target.checked
            ? [...prev, id] // Add ID when checked
            : prev.filter((item) => item !== id), // Remove ID when unchecked
      );
    };

  const handleBulkApproveCheckIds =
    (item: any) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setCheckedBulkApproveIds((prevState) => {
        if (event.target.checked) {
          return {
            ...prevState,
            [item._id]: {
              // Use `_id` as the key
              transactionId: item.transactionId,
              updatedBy: { name: User?.data?.name || "", status: "Approved" },
            },
          };
        } else {
          const newState = { ...prevState };
          delete newState[item._id]; // Remove the unchecked item
          return newState;
        }
      });
    };

  const handleBulkManualApproveCheckIds =
    (item: any) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setCheckedBulkManualApproveIds((prevState) => {
        if (event.target.checked) {
          return {
            ...prevState,
            [item._id]: {
              // Use `_id` as the key
              transactionId: item.transactionId,
              updatedBy: {
                name: User?.data?.name || "",
                status: "Approved",
                _id: User?.data._id,
              },
            },
          };
        } else {
          const newState = { ...prevState };
          delete newState[item._id]; // Remove the unchecked item
          return newState;
        }
      });
    };

  const handleBulkLockSubmit = async () => {
    let token = localStorage.getItem("token");
    let data: any = {
      transactionId: checkedLockIds,
      updatedBy: {
        name: User.data.name,
        userId: User.data._id,
        status: "true",
        date:new Date().toISOString(),
        city: address?.city,
        state: address?.state,
        lat: locationInfo?.coords?.latitude?.toString(),
        long: locationInfo?.coords?.longitude?.toString(),
      },
    };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/transaction/bulk-lock`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(data) },
    };

    await API_Handler.request(config)
      .then((response) => {
        toast.success("Bulk Lock successfully");
        setCheckLockIds([]);
        filterTransaction();
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleBulkUnLockSubmit = async () => {
    let token = localStorage.getItem("token");
    let data: any = { transactionId: checkedUnLockIds };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/transaction/bulk-unlock`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(data) },
    };

    await API_Handler.request(config)
      .then((response) => {
        toast.success("Bulk UnLock successfully");
        setCheckUnLockIds([]);
        filterTransaction();
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleCheckedApproveIdsSubmit = async () => {
    if (
      locationInfo?.coords?.latitude &&
      locationInfo?.coords?.longitude &&
      address?.state &&
      address?.city
    ) {
      let token = localStorage.getItem("token");
      let data: any = {
        transactionId: Object.keys(checkedBulkApproveIds)?.map(
          (item) => checkedBulkApproveIds[item],
        ),
        withdrewalProviderName: paymentGateway,
        state: address?.state,
        city: address?.city,
        lat: locationInfo?.coords?.latitude?.toString(),
        long: locationInfo?.coords?.longitude?.toString(),
      };
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/transaction/bulk-Approve`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { token: encryptData(data) },
      };

      await API_Handler.request(config)
        .then((response) => {
          toast.success("Bulk Approved successfully");
          filterTransaction();
          setCheckedBulkApproveIds({});
        })
        .catch((error) => {
          console.log(error);
        });
    } else {
      toast.error("Location Information Missing");
      locationInfo?.requestLocation();
      getAddress();
      return;
    }
  };

  const handleBulkManualApproveSubmit = async () => {
    if (
      locationInfo?.coords?.latitude &&
      locationInfo?.coords?.longitude &&
      address?.state &&
      address?.city
    ) {
      let token = localStorage.getItem("token");
      // let data: any = { transactionId: checkedBulkManualApproveIds };
      // let data: any = {transactionId: Object.values(checkedBulkManualApproveIds).map((item) => item.transactionId),};
      let data: any = {
        state: address?.state,
        city: address?.city,
        lat: locationInfo?.coords?.latitude?.toString(),
        long: locationInfo?.coords?.longitude?.toString(),
        gatewayName: gatewayName,
        mid: selectMidName,
        transactionId: Object.values(checkedBulkManualApproveIds).map(
          (item) => ({
            transactionId: item.transactionId,
            name: item.updatedBy.name,
            _id: item.updatedBy._id,
          }),
        ),
      };
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/transaction/bulk-manual-approved`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { token: encryptData(data) },
      };

      await API_Handler.request(config)
        .then((response) => {
          toast.success("Bulk Manual Approe successfully");
          filterTransaction();
        })
        .catch((error) => {
          console.log(error);
          toast.error(error.response.data.message);
        });
    } else {
      toast.error("Location Information Missing");
      locationInfo?.requestLocation();
      getAddress();
      return;
    }
  };

  const handleWithdrawReasonSelect = (
    e: ChangeEvent<HTMLInputElement>,
    transactionId: any,
  ) => {
    let reason = e.target.value;
    let token = localStorage.getItem("token");
    setLoading(true);
    let payload = {
      delayReason: {
        name: User?.data.name,
        userId: User?.data._id,
        reason: reason,
      },
      transactionId: transactionId,
    };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/transaction/delay-reason`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(payload) },
    };

    API_Handler.request(config)
      .then(async (response) => {
        let Response = await decryptData(response.data.data);
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
      });
  };

  function getRandomColorByTime(inputTime: any) {
    // List of colors to choose from
    const colors = [
      "#FF5733",
      "#33FF57",
      "#3357FF",
      "#F033FF",
      "#FF33A8",
      "#33FFF5",
      "#FF8C33",
      "#8C33FF",
    ];

    // Convert input time to Date object (assuming format "3 am" or "3:00 am")
    const parseTime = (timeStr: any) => {
      const [hourStr, modifier] = timeStr.toLowerCase().split(/(am|pm)/);
      let hours = parseInt(hourStr);
      if (modifier === "pm" && hours !== 12) hours += 12;
      if (modifier === "am" && hours === 12) hours = 0;
      return hours;
    };

    // Get current hour (24-hour format)
    const now = new Date();
    const currentHour = now.getHours();

    // Get input hour
    const inputHour = parseTime(inputTime);

    // Calculate hour difference
    const hourDiff = Math.abs(currentHour - inputHour);

    // Use hour difference to select color (modulo ensures it stays within array bounds)
    const colorIndex = hourDiff % colors.length;

    return colors[colorIndex];
  }

  // Function to handle checkbox change
  const handleCheckboxChange = (e: any) => {
    const checkedStatus = e.target.checked;
    setSordChecked(checkedStatus);
    filterTransaction();
  };

  const [isDownloadDisabled, setIsDownloadDisabled] = useState(false);

  useEffect(() => {
    const roleId = localStorage.getItem("role_id");
    if (roleId === "6572e1e4327edd475a3c997f") {
      setIsDownloadDisabled(true);
    }
  }, []);

  // copty mobile
  const copyMobile = async (textToCopy: any) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${textToCopy} Coppied`);
    } catch (err) {
      console.log(err);
    }
  };

  const formatDate = (date: any) => {
    const istDate = new Date(date);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
      .format(istDate)
      .replace(/\//g, "-");
  };

  const handleGatewayChange = (e: any) => {
    setGatewayName(e.target.value);
    setSelectMidName("");
  };

  const getPaymentMidsData = async () => {
    let token = localStorage.getItem("token");
    let data: any = {};
    setLoading(true);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/payinAccounts/getAllMidOld`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(data) },
    };

    await axios
      .request(config)
      .then(async (response) => {
        setLoading(false);
        let API_RESPONSE = response.data.data;
        setMidArray(API_RESPONSE.payload);
      })
      .catch((error) => {
        setLoading(false);
        console.log(error);
      });
  };

  const getBeneAccList = async () => {
    let token = localStorage.getItem("token");
    setLoading(true);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/change-percentage/available-banks/get`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData({}) },
    };

    await axios
      .request(config)
      .then(async (response) => {
        setLoading(false);
        let API_RESPONSE = await decryptData(response.data.data);
        setBeneAccArray(API_RESPONSE?.payload?.availableBanks);
      })
      .catch((error) => {
        setLoading(false);
        console.log(error);
      });
  };
  useEffect(() => {
    getPaymentMidsData();
    getBeneAccList();
  }, []);

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
              <Breadcrumbs tab={"Withdrawal"} />
              <div>
                <Dialog open={openPopup} onClose={() => setOpenPopup(false)}>
                  <DialogContent>
                    <form onSubmit={handleSubmit}>
                      {actionPopup === "Approved" ? (
                        <div className="d-flex justify-content-center">
                          <p>Are you sure ?</p>
                        </div>
                      ) : (
                        <div>
                          <Reusable_Input
                            type={"text"}
                            label={"Please enter remark"}
                            fullWidth={true}
                            value={remark}
                            error={remarkError}
                            helperText={remarkHelperText}
                            onChange={handleRemark}
                          />
                          {!["Approved", "Reverse"]?.includes(actionPopup) && (
                            <>
                              <span>Select Gateway Name:</span>
                              <select
                                value={gatewayName}
                                onChange={handleGatewayChange}
                                style={{
                                  width: "250px",
                                  padding: "10px",
                                  borderRadius: "6px",
                                  fontSize: "16px",
                                  marginLeft: 10,
                                  marginTop: 10,
                                }}
                              >
                                <option value="">--Choose--</option>
                                <option value="bramhadev">Bramhadev</option>
                                <option value="jk Bank">J&K Bank</option>
                                <option value="personal">Personal</option>
                                <option value="kotak">Kotak</option>
                                <option value="OFS-HDFC">OFS-HDFC</option>
                                <option value="OFS-AXIS">OFS-AXIS</option>
                                <option value="axis">Axis</option>
                                <option value="payok">Pay Ok</option>
                                <option value="uco">Uco</option>
                                <option value="ansin-ecommerce-JK">
                                  Ansin-Ecommerce-JK
                                </option>
                                <option value="OFS-ansin">OFS-ansin</option>
                                <option value="digitech">Digitech</option>
                                <option value="rpf">Royal Pets</option>
                                <option value="shyam-trading">
                                  SHYAM-TRADING
                                </option>
                              </select>
                              <br />
                              <span>Select Mid Name:</span>
                              <select
                                value={selectMidName}
                                onChange={(e) =>
                                  setSelectMidName(e.target.value)
                                }
                                style={{
                                  width: "250px",
                                  padding: "10px",
                                  borderRadius: "6px",
                                  fontSize: "16px",
                                  marginLeft: 10,
                                  marginTop: 10,
                                }}
                              >
                                <option value="">--Choose--</option>

                                {midArray?.map((mid: any, index: any) => (
                                  <option key={index} value={mid?.mid}>
                                    {mid?.mid}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      )}
                      <DialogActions>
                        <Button
                          className="btn-popup"
                          variant="outlined"
                          onClick={() => setOpenPopup(false)}
                          color="primary"
                        >
                          Cancel
                        </Button>
                        <Button
                          className="btn-popup"
                          variant="outlined"
                          type="submit"
                          color="primary"
                          disabled={loading}
                        >
                          Submit
                        </Button>
                      </DialogActions>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="container-fluid">
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
                      <label className="lbl">Items Per Page</label>
                      <div className="mt-1">
                        <Stateful_Select
                          value={itemsPerPage.toString()}
                          onChange={(newValue: any) => handlePerPage(newValue)}
                          options={[
                            "10",
                            "25",
                            "50",
                            "75",
                            "100",
                            "500",
                            "1000",
                            "1500",
                            "2000",
                          ]}
                          className="deposit-select"
                        />
                      </div>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a
                        onClick={filterTransactionData}
                        className="sechBtn mt-1"
                      >
                        Apply
                      </a>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a
                        id="alldata"
                        onClick={(e) => filterTransactionData(e)}
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

                    {/* {User.data.Responsibilities.includes(
                      Responsibilities.hide_withdrawal_details,
                    ) && ( */}
                    <>
                      <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>Total User : {totalUser}</b>
                      </div>
                      <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>
                          Approved{" "}
                          {`(${
                            totalWithdrawData?.totalApprovedCount
                              ? totalWithdrawData?.totalApprovedCount
                              : 0
                          }) : ${
                            totalWithdrawData?.totalApprovedAmount
                              ? totalWithdrawData?.totalApprovedAmount
                              : 0
                          }`}
                        </b>
                      </div>
                      <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>
                          Rejected{" "}
                          {`(${
                            totalWithdrawData?.totalRejectedCount
                              ? totalWithdrawData?.totalRejectedCount
                              : 0
                          }) : ${
                            totalWithdrawData?.totalRejectedAmount
                              ? totalWithdrawData?.totalRejectedAmount
                              : 0
                          }`}
                        </b>
                      </div>
                      <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>
                          Pending{" "}
                          {`(${
                            totalWithdrawData?.totalPendingCount
                              ? totalWithdrawData?.totalPendingCount
                              : 0
                          }) : ${
                            totalWithdrawData?.totalPendingAmount
                              ? totalWithdrawData?.totalPendingAmount
                              : 0
                          }`}
                        </b>
                      </div>
                      <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>
                          Reverse{" "}
                          {`(${
                            totalWithdrawData?.totalReversedCount
                              ? totalWithdrawData?.totalReversedCount
                              : 0
                          }) : ${
                            totalWithdrawData?.totalReversedAmount
                              ? totalWithdrawData?.totalReversedAmount
                              : 0
                          }`}
                        </b>
                      </div>
                      <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>
                          On Hold{" "}
                          {`(${
                            totalWithdrawData?.totalOnholdCount
                              ? totalWithdrawData?.totalOnholdCount
                              : 0
                          }) : ${
                            totalWithdrawData?.totalOnholdAmount
                              ? totalWithdrawData?.totalOnholdAmount
                              : 0
                          }`}
                        </b>
                      </div>
                      <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>
                          Cancelled{" "}
                          {`(${
                            totalWithdrawData?.totalCanceledCount
                              ? totalWithdrawData?.totalCanceledCount
                              : 0
                          }) : ${
                            totalWithdrawData?.totalCanceledAmount
                              ? totalWithdrawData?.totalCanceledAmount
                              : 0
                          }`}
                        </b>
                      </div>
                    </>
                    {/* )} */}
                    <div
                      className="col-6 col-xl-2 col-sm-4 pdrt "
                      style={{ cursor: "pointer" }}
                    >
                      <label className="lbl"></label>
                      <a onClick={clearFilters} className="sechBtn mt-1">
                        Clear All Filters
                      </a>
                    </div>
                    {/* {(
											(User.data.Responsibilities.includes(Responsibilities.Excel) && User.data.Role_ID === "64f710d9a2ab78980020c5fb") ||
											User.data.mobile === "8740046022"
										) && ( */}
                    {User.data.Responsibilities.includes(
                      Responsibilities.Download_Withdrawal,
                    ) && (
                      <>
                        <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                          <div className="excel_sheet exdd widr">
                            <ExcelExport
                              inputData={transformedData}
                              headings={[
                                [
                                  "Sr No",
                                  "Date",
                                  "accountHolderName",
                                  "Name (send to bank)",
                                  "bankName",
                                  "city",
                                  "state",
                                  "status",
                                  "dp_id",
                                  "transactionId",
                                  "Acc No",
                                  "Amount",
                                  "userBankName",
                                  "ifscCode",
                                ],
                              ]}
                              fileName={"Withdrawal_Data"}
                              sheetType="withdrawal"
                              filterData={{
                                mid:
                                  withdrawalProviderName ||
                                  preferredwithdrawalProviderName ||
                                  "withdrawal",
                                type: "Withdrawal Sheet",
                              }}
                              address={address}
                              locationInfo={locationInfo}
                            />
                            Download Data
                          </div>
                        </div>
                      </>
                    )}

                    {User.data.Responsibilities.includes(
                      Responsibilities.Download_Withdrawal,
                    ) && (
                      <>
                        <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                          <div
                            className="excel_sheet exdd widr"
                            style={{ marginLeft: 10 }}
                          >
                            <ExcelExport
                              inputData={transformedData}
                              headings={[
                                [
                                  "Sr No",
                                  "Name",
                                  "Transfer Type",
                                  "Acc No",
                                  "Amount",
                                  "IFSC",
                                  "Phone No",
                                  "Remarks",
                                ],
                              ]}
                              fileName={"yes_bank_sheet"}
                              sheetType="yesBank"
                              filterData={{
                                mid: "yesBank",
                                type: "Withdrawal Sheet",
                              }}
                              address={address}
                              locationInfo={locationInfo}
                            />
                            Yes Bank Data
                          </div>
                        </div>
                      </>
                    )}
                    {User.data.Responsibilities.includes(
                      Responsibilities.Download_Withdrawal,
                    ) && (
                      <>
                        <div className="col-12 col-xl-2 col-sm-4 pdrt d-flex align-items-center mt-3">
                          <div
                            className="excel_sheet exdd widr"
                            style={{ marginLeft: 10 }}
                          >
                            <ExcelExport
                              inputData={transformedData}
                              headings={[
                                [
                                  "Bank Name (IFSC)",
                                  "Bank Account",
                                  "Amount(INR)",
                                  "Phone Number",
                                  "AccountName",
                                  "Email",
                                ],
                              ]}
                              fileName={"pay_ok_sheet"}
                              sheetType="payOk"
                              filterData={{
                                mid: "payok",
                                type: "Withdrawal Sheet",
                              }}
                              address={address}
                              locationInfo={locationInfo}
                            />
                            Pay OK Data
                          </div>
                        </div>
                      </>
                    )}

                    {User.data.Responsibilities.includes(
                      Responsibilities.withdrawals_button,
                    ) && (
                      <>
                        <div
                          className="col-6 col-xl-2 col-sm-4 pdrt "
                          style={{ cursor: "pointer" }}
                        >
                          <label className="lbl"></label>
                          <a
                            onClick={handleBulkLockSubmit}
                            className="sechBtn mt-1"
                          >
                            Bulk Lock
                          </a>
                        </div>
                        <div
                          className="col-6 col-xl-2 col-sm-4 pdrt "
                          style={{ cursor: "pointer" }}
                        >
                          <label className="lbl"></label>
                          <a
                            onClick={handleBulkUnLockSubmit}
                            className="sechBtn mt-1"
                          >
                            Bulk UnLock
                          </a>
                        </div>
                        <div
                          className="col-6 col-xl-2 col-sm-4 pdrt "
                          style={{ cursor: "pointer" }}
                        >
                          <label className="lbl"></label>
                          <a
                            onClick={handleCheckedApproveIdsSubmit}
                            className="sechBtn mt-1"
                          >
                            Bulk Approve
                          </a>
                        </div>
                        <div
                          className="col-6 col-xl-2 col-sm-4 pdrt "
                          style={{ cursor: "pointer" }}
                        >
                          <label className="lbl"></label>
                          <a
                            onClick={() => setBulkManualApprovePopup(true)}
                            className="sechBtn mt-1"
                          >
                            Bulk Manual Approve
                          </a>
                        </div>

                        <div
                          className="col-6 col-xl-2 col-sm-4 pdrt "
                          style={{ cursor: "pointer" }}
                        >
                          <label className="lbl"></label>
                          <a
                            onClick={() => setOpenCreateBene(true)}
                            className="sechBtn mt-1"
                          >
                            Add Bene List
                          </a>
                        </div>

                        <div className="col-6 col-xl-2 col-sm-4 pdrt">
                          <label className="lbl">Bank Amount</label>
                          <div className="mt-1">
                            <input
                              className="form-control w-full mb-2"
                              placeholder="Bank Amount"
                              value={bankAmt}
                              maxLength={6}
                              onChange={(e) => setBankAmt(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-6 col-xl-2 col-sm-4 pdrt">
                          <label className="lbl">Mid Name</label>
                          <div className="mt-1">
                            <select
                              className="form-control w-full mb-2"
                              value={beneAccName}
                              onChange={(e) => {
                                setBeneAccName(e.target.value);
                                setCurrentPage(1);
                              }}
                            >
                              <option value="">--Choose--</option>
                              {BeneAccArray?.map((bank: string, index: number) => (
                                <option key={index} value={bank}>
                                  {bank}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="col-6 col-xl-2 mt-2 col-sm-4 pdrt">
                          <div className="sort-label_">Sort</div>
                          <input
                            type="checkbox"
                            name="sort_data"
                            id="sort_data-checkbox"
                            checked={sortChecked}
                            onChange={handleCheckboxChange}
                          />
                        </div>
                      </>
                    )}
                    {!User.data.Responsibilities.includes(
                      Responsibilities.withdrawals_button,
                    ) && (
                      <>
                        <div className="col-6 col-xl-2 col-sm-4 pdrt">
                          <label className="lbl">Bank Amount</label>
                          <div className="mt-1">
                            <input
                              className="form-control w-full mb-2"
                              placeholder="Bank Amount"
                              value={bankAmt}
                              maxLength={6}
                              onChange={(e) => setBankAmt(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-6 col-xl-2 col-sm-4 pdrt">
                          <label className="lbl">Mid Name</label>
                          <div className="mt-1">
                            <select
                              className="form-control w-full mb-2"
                              value={withdrawalProviderName}
                              onChange={(e) =>
                                setWithdrawalProviderName(e.target.value)
                              }
                            >
                              <option value="">--Choose--</option>
                              {midArray?.map((mid: any, index: any) => (
                                <option key={index} value={mid?.mid}>
                                  {mid?.mid}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="col-12 mt-1">
                    <div className="table-responsive withdrawal-table-scroll">
                      <table className="table table-view">
                        <thead>
                          <tr>
                            <th className="text-center wd-sticky wd-sticky-index"></th>
                            <th className="text-center wd-sticky wd-sticky-user">
                              User <br /> Name
                            </th>
                            <th className="text-center wd-sticky wd-sticky-bank">
                              Name <br />
                              (Send to Bank)
                            </th>
                            {User?.data?.Responsibilities?.includes(
                              Responsibilities.contact_visibility_none,
                            ) === false && (
                              <th className="text-center">
                                Mobile <br /> NO
                              </th>
                            )}
                            <th className="text-center">
                              App <br /> Name
                            </th>
                            <th className="text-center">
                              Amount
                              <button
                                onClick={toggleSort}
                                className="dropDownBtn"
                              >
                                {isAscending ? "▲" : "▼"}
                              </button>
                            </th>
                            <th className="text-center">
                              Beneficiary
                              <br />
                              Acc Name
                            </th>
                            <th className="text-center">State</th>
                            <th className="text-center">City</th>
                            <th className="text-center">
                              User Bank <br /> Name
                            </th>
                            <th className="text-center">
                              Win <br /> In
                            </th>
                            <th className="text-center">Status</th>
                            <th className="text-center">Date</th>
                            <th className="text-center">Time</th>
                            <th className="text-center">
                              Commission <br /> Amount
                            </th>
                            <th className="text-center">
                              Transaction <br /> Id
                            </th>
                            <th className="text-center">
                              Dp <br /> Id
                            </th>
                            <th className="text-center">
                              Account <br /> No
                            </th>
                            <th className="text-center">
                              Bank <br /> Name
                            </th>
                            <th className="text-center">IFSC</th>
                            {/* {User?.data?.Responsibilities?.includes(
                              Responsibilities.withdrawals_button
                            ) && (
                              <> */}
                            <th className="text-center">
                              Check <br /> By Bot
                            </th>
                            <th className="text-center">
                              Lock <br /> By
                            </th>
                            <th className="text-center">
                              Check <br /> By
                            </th>
                            <th className="text-center">Select Delay Reason</th>
                            <th className="text-center">Delay Reason</th>
                            <th className="text-center">
                              Cross Check <br /> By
                            </th>
                            {User.data.Responsibilities.includes(
                              Responsibilities.withdrawals_button,
                            ) && (
                              <>
                                <th className="text-center">Lock</th>
                                <th className="text-center">
                                  Withdrawal <br /> Provider
                                </th>
                                {/* Hidden: depends on approved-deposit-withdrawal-report
                                <th className="text-center">
                                  Preferred Withdrawal
                                  <br />
                                  Gateway
                                </th>
                                */}
                                <th className="text-center">
                                  Reverse Withdrawal
                                </th>
                                {User?.data?.Responsibilities?.includes(
                                  Responsibilities.View_Reject,
                                ) === true && (
                                  <th className="text-center">
                                    Reject Withdrawal
                                  </th>
                                )}
                                {/* {User?.data?.Responsibilities?.includes(Responsibilities.View_Reject) === false && <th className='text-center'>Reject Withdrawal</th>} */}
                                <th className="text-center">Action</th>
                                <th className="text-center">Bulk Approve</th>
                                <th className="text-center">
                                  Bulk Manual Approve
                                </th>
                              </>
                            )}
                            <th className="text-center">
                              Updated <br /> By
                            </th>
                            <th className="text-center">
                              PnL Before <br /> Withdrawal
                            </th>
                            <th className="text-center">
                              PnL After <br /> Withdrawal
                            </th>
                          </tr>
                        </thead>
                        <thead>
                          <tr className="bg-table">
                            <th className="thdr wd-sticky wd-sticky-index"></th>
                            <th className="thdr wd-sticky wd-sticky-user">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserName}
                                  onChange={handleSearchUserName}
                                  onSearch={filterTransaction}
                                  placeholder="Search by user name"
                                />
                              </div>
                            </th>
                            <th className="thdr wd-sticky wd-sticky-bank"></th>
                            {User?.data?.Responsibilities?.includes(
                              Responsibilities.contact_visibility_none,
                            ) === false && (
                              <th className="thdr">
                                <div className="d-flex justify-content-center">
                                  <SearchBar
                                    value={searchUserMobileNo}
                                    onChange={handleSearchUserMob}
                                    onSearch={filterTransaction}
                                    placeholder="Search by mobile no"
                                  />
                                </div>
                              </th>
                            )}
                            <th className="thdr">
                              <Select
                                labelId="demo-select-small-label"
                                id="demo-select-small"
                                label="Select App Name"
                                value={appClientName}
                                onChange={Handle_App_Client_Name}
                              >
                                {Filtered_Client_Names?.map(
                                  (appName: any, index: number) => (
                                    <MenuItem key={index} value={appName}>
                                      {appName}
                                    </MenuItem>
                                  ),
                                )}
                              </Select>
                            </th>
                            <th className="thdr">
                              {/* <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserAmount}
                                  onChange={handleSearchUserAmount}
                                  onSearch={filterTransaction}
                                  placeholder="Search by amount"
                                />
                              </div> */}
                              <div style={{ display: "flex" }}>
                                <div>
                                  <label className="lbl">Min</label>
                                  <input
                                    className="form-control created-on-filter-group"
                                    placeholder="Min"
                                    value={min}
                                    style={{ width: 70 }}
                                    maxLength={6}
                                    onChange={(e) => setMin(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="lbl">Max</label>
                                  <input
                                    className="form-control created-on-filter-group"
                                    placeholder="Max"
                                    style={{ width: 70, marginLeft: 5 }}
                                    value={max}
                                    maxLength={6}
                                    onChange={(e) => setMax(e.target.value)}
                                  />
                                </div>
                                <SearchIcon onClick={filterTransaction} />
                              </div>
                            </th>
                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <FormControl fullWidth>
                                  <InputLabel id="demo-simple-select-label">
                                    Select State
                                  </InputLabel>
                                  <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    value={searchWithdrawUserState}
                                    label="Status"
                                    onChange={(e: any) =>
                                      handleWithdrawSearchState(e)
                                    }
                                  >
                                    {states?.map((state) => {
                                      return (
                                        <MenuItem value={state}>
                                          {state}
                                        </MenuItem>
                                      );
                                    })}
                                  </Select>
                                </FormControl>
                              </div>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchWithdrawUserCity}
                                  onChange={handleWithdrawSearchCity}
                                  onSearch={filterTransaction}
                                  placeholder="Search by user city"
                                />
                              </div>
                            </th>
                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center withdraw-select">
                                <FormControl fullWidth>
                                  <InputLabel id="demo-simple-select-label">
                                    Select Win In
                                  </InputLabel>
                                  <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    value={searchWinInStatus}
                                    label="Age"
                                    onChange={(e: any) => handleWinIn(e)}
                                  >
                                    <MenuItem value={"E"}>E</MenuItem>
                                    <MenuItem value={"C"}>C</MenuItem>
                                    <MenuItem value={"S"}>S</MenuItem>
                                    {/* <MenuItem value={"All"}>All</MenuItem>
																		<MenuItem value={"Falcon"}>Falcon</MenuItem>
																		<MenuItem value={"Jetfair"}>Jetfair</MenuItem>
																		<MenuItem value={"Qtech"}>Qtech</MenuItem>
																		<MenuItem value={"Sattamatka"}>Sattamatka</MenuItem>
																		<MenuItem value={"Wacs"}>Wacs</MenuItem>
																		<MenuItem value={"Coin"}>Coin</MenuItem>
																		<MenuItem value={"winBig"}>WinBig</MenuItem>
																		<MenuItem value={"bonus wallet approve"}>Bonus Wallet Approve</MenuItem> */}
                                  </Select>
                                </FormControl>
                              </div>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center withdraw-select">
                                <FormControl fullWidth>
                                  <InputLabel id="demo-simple-select-label">
                                    Select Status
                                  </InputLabel>
                                  <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    value={searchUserStatus}
                                    label="Age"
                                    onChange={(e: any) => handleSelect(e)}
                                  >
                                    <MenuItem value={"All"}>All</MenuItem>
                                    <MenuItem value={"Pending"}>
                                      Pending
                                    </MenuItem>
                                    <MenuItem value={"IN PROGRESS"}>
                                      IN PROGRESS
                                    </MenuItem>
                                    <MenuItem value={"Processing"}>
                                      Processing
                                    </MenuItem>
                                    <MenuItem value={"Approved"}>
                                      Approved
                                    </MenuItem>
                                    <MenuItem value={"Failed"}>Failed</MenuItem>
                                    <MenuItem value={"Cancel"}>Cancel</MenuItem>
                                    <MenuItem value={"Rejected"}>
                                      Rejected
                                    </MenuItem>
                                    <MenuItem value={"Reverse"}>
                                      Reverse
                                    </MenuItem>
                                    <MenuItem value={"on hold"}>
                                      on hold
                                    </MenuItem>
                                    <MenuItem value={"Cancel"}>
                                      Canceled by customer
                                    </MenuItem>
                                  </Select>
                                </FormControl>
                              </div>
                            </th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserTransactionId}
                                  onChange={handleSearchUserTransactionId}
                                  onSearch={filterTransaction}
                                  placeholder="Search by transaction id"
                                />
                              </div>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserDpId}
                                  onChange={handleSearchUserDpId}
                                  onSearch={filterTransaction}
                                  placeholder="Search by dp id"
                                />
                              </div>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserAccountNo}
                                  onChange={handleSearchUserAccountNo}
                                  onSearch={filterTransaction}
                                  placeholder="Search by account no"
                                />
                              </div>
                            </th>

                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserIfsc}
                                  onChange={handleSearchUserIfsc}
                                  onSearch={filterTransaction}
                                  placeholder="Search by ifsc no"
                                />
                              </div>
                            </th>
                            {/* {User?.data?.Responsibilities?.includes(
                              Responsibilities.withdrawals_button
                            ) && (
                              <> */}
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            {/* <th className="thdr"></th> */}
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            {User.data.Responsibilities.includes(
                              Responsibilities.withdrawals_button,
                            ) && (
                              <>
                                <th className="thdr"></th>
                                <th className="thdr">
                                  <div className="d-flex justify-content-center withdraw-select">
                                    <FormControl fullWidth>
                                      <InputLabel id="demo-simple-select-label">
                                        Select Mid
                                      </InputLabel>
                                      <Select
                                        labelId="demo-simple-select-label"
                                        id="demo-simple-select"
                                        value={withdrawalProviderName}
                                        label="Age"
                                        onChange={(e: any) =>
                                          setWithdrawalProviderName(
                                            e?.target?.value,
                                          )
                                        }
                                      >
                                        {midArray?.map(
                                          (mid: any, index: any) => (
                                            <MenuItem
                                              key={index}
                                              value={mid?.mid}
                                            >
                                              {mid?.mid}
                                            </MenuItem>
                                          ),
                                        )}
                                      </Select>
                                    </FormControl>
                                  </div>
                                </th>
                                {/* Hidden: Preferred Withdrawal Gateway mid filter
                                <th className="thdr">
                                  <div className="d-flex justify-content-center withdraw-select">
                                    <FormControl fullWidth>
                                      <InputLabel id="demo-simple-select-label">
                                        Select Mid
                                      </InputLabel>
                                      <Select
                                        labelId="demo-simple-select-label"
                                        id="demo-simple-select"
                                        value={preferredwithdrawalProviderName}
                                        label="Age"
                                        onChange={(e: any) =>
                                          setPreferredWithdrawalProviderName(
                                            e?.target?.value,
                                          )
                                        }
                                      >
                                        {midArray?.map(
                                          (mid: any, index: any) => (
                                            <MenuItem
                                              key={index}
                                              value={mid?.mid}
                                            >
                                              {mid?.mid}
                                            </MenuItem>
                                          ),
                                        )}
                                      </Select>
                                    </FormControl>
                                  </div>
                                </th>
                                */}
                                <th className="thdr"></th>
                                <th className="thdr"></th>
                                <th className="thdr"></th>
                                <th className="thdr"></th>
                              </>
                            )}

                            {/* </>
                            )} */}
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {withdrawData?.map((item: any, Index) => {
                            // console.log("widthdrawData====>", formatedTime(item.updatedOn));
                            // Preferred gateway rows came from approved-deposit-withdrawal-report
                            // const dataArray = preferredwithdrawalProviderName
                            //   ? item?.updatedData || []
                            //   : [item];
                            const dataArray = [item];

                            return dataArray.map((data: any, i: number) => (
                              <tr
                                className={
                                  item.status !== "Cancel" &&
                                  item.status !== "Rejected" &&
                                  item.status !== "Reverse" &&
                                  item.status !== "Failed" &&
                                  item.status !== "Approved" &&
                                  "validationCheckedAt" in item &&
                                  Number(item?.passedPoints) >= 13
                                    ? "withdraw-bot-clr"
                                    : item?.status === "Approved"
                                      ? "withdraw-approved-clr"
                                      : item?.status === "Pending"
                                        ? "withdraw-pending-clr"
                                        : item?.status === "Rejected"
                                          ? "withdraw-rejected-clr"
                                          : item?.status === "on hold"
                                            ? "withdraw-onhold-clr"
                                            : item?.status === "Reverse"
                                              ? "withdraw-reverse-clr"
                                              : item?.status === "Failed"
                                                ? "withdraw-Failed-clr"
                                                : item?.status === "Cancel"
                                                  ? "withdraw-Cancel-clr"
                                                  : ""
                                }
                                style={{
                                  backgroundColor:
                                    item.status === "Cancel"
                                      ? "rgb(233 0 0 / 58%)"
                                      : "",
                                  color: item.status === "Cancel" ? "#fff" : "",
                                }}
                              >
                                <td className="col-2 wd-sticky wd-sticky-index">
                                  {Index +
                                    1 +
                                    (currentPage && itemsPerPage
                                      ? (currentPage - 1) * itemsPerPage
                                      : 0)}
                                </td>
                                <td
                                  className="col-2 wd-sticky wd-sticky-user"
                                  id={item._id}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => {
                                    if (
                                      User?.data?.Responsibilities?.includes(
                                        Responsibilities.wallet_history,
                                      )
                                    ) {
                                      const url = `/user-report/${item.dp_id}/${item.accountHolderName}`;
                                      window.open(url, "_blank");
                                    }
                                  }}
                                >
                                  {item.accountHolderName}
                                </td>
                                <td className="col-2 wd-sticky wd-sticky-bank">
                                  {`${item?.accountHolderName?.slice(0, 6)}-${item?.dp_id?.slice(-6)}`}
                                </td>
                                {User?.data?.Responsibilities?.includes(
                                  Responsibilities.contact_visibility_none,
                                ) === false && (
                                  <td>
                                    {User?.data?.Responsibilities?.includes(
                                      Responsibilities.show_mobile,
                                    ) ? (
                                      <>
                                        {item?.mobile}{" "}
                                        <ContentCopyIcon
                                          onClick={() =>
                                            copyMobile(item?.mobile)
                                          }
                                          style={{
                                            color: "#333",
                                            fontSize: "17px",
                                            marginLeft: "10px",
                                            cursor: "pointer",
                                          }}
                                        />
                                      </>
                                    ) : (
                                      "**********"
                                    )}
                                  </td>
                                )}
                                <td className="col-2">{item?.clientName}</td>
                                <td className="col-2">{item?.amount}</td>
                                <td
                                  style={{
                                    width: "175px",
                                    minWidth: "175px",
                                    maxWidth: "175px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "8px",
                                      width: "100%",
                                    }}
                                  >
                                    <BeneficiarySelect
                                      beneficiaryAccounts={extractBeneficiaryAccounts(
                                        item,
                                      )}
                                      selectId={`bene-select-${item.transactionId}`}
                                    />
                                    <Button
                                      onClick={() => handleBeneClick(item)}
                                      className="btn-withdraw"
                                      variant="contained"
                                    >
                                      Add Bene
                                    </Button>
                                  </div>
                                </td>
                                <td className="col-2">{item?.state}</td>
                                <td className="col-2">{item?.city}</td>
                                <td className="col-2">{item?.userBankName}</td>
                                <td
                                  className="col-2"
                                  style={{ whiteSpace: "normal" }}
                                >
                                  {item?.playedGames?.join(", ")}
                                </td>
                                <td className="col-2">{item.status}</td>
                                <td className="col-2">
                                  {formatDate(item?.createdOn)}
                                </td>
                                {/* <td className="col-2">
																{formatedTime(item?.createdOn)}
															</td> */}
                                <td
                                  className={`col-2 ${(() => {
                                    if (item.status !== "Pending") return "";
                                    const createdTime = new Date(
                                      item?.createdOn,
                                    ).getTime();
                                    const currentTime = Date.now();
                                    const diff = currentTime - createdTime;

                                    const oneHour = 60 * 60 * 1000;
                                    const twoHourOneMin =
                                      (2 * 60 + 1) * 60 * 1000;
                                    const oneHourOneMin =
                                      (1 * 60 + 1) * 60 * 1000;

                                    if (diff <= oneHour) return "bg-info";
                                    if (
                                      diff <= twoHourOneMin &&
                                      diff > oneHourOneMin
                                    )
                                      return "bg-warning";
                                    if (diff > twoHourOneMin)
                                      return "bg-secondary";

                                    return "";
                                  })()}`}
                                >
                                  {formatedTime(item?.createdOn)}
                                </td>

                                <td className="col-2">
                                  {item.commissionAmount}
                                </td>
                                <td className="col-2">{item.transactionId}</td>
                                <td>{item.dp_id}</td>
                                <td>
                                  {`******${item?.accountNo?.slice(-4)}`}
                                  <ContentCopyIcon
                                    onClick={() => copyMobile(item?.accountNo)}
                                    style={{
                                      color: "#333",
                                      fontSize: "17px",
                                      marginLeft: "10px",
                                      cursor: "pointer",
                                    }}
                                  />
                                </td>
                                <td>{item.bankName}</td>
                                <td>
                                  {`******${item?.ifscCode?.slice(-4)}`}
                                  <ContentCopyIcon
                                    onClick={() => copyMobile(item?.ifscCode)}
                                    style={{
                                      color: "#333",
                                      fontSize: "17px",
                                      marginLeft: "10px",
                                      cursor: "pointer",
                                    }}
                                  />
                                </td>
                                <td>
                                  {item.status === "Cancel" ||
                                  item.status === "Rejected" ||
                                  item.status === "Reverse" ||
                                  item.status === "Failed" ? (
                                    ""
                                  ) : (
                                    <div>
                                      {"validationCheckedAt" in item ? (
                                        <>
                                          <span>
                                            <span
                                              style={{ fontWeight: "bold" }}
                                            >{`Check by Bot`}</span>{" "}
                                            <br />
                                            {`${formatDate(
                                              item?.validationCheckedAt,
                                            )} ${formatedTime(
                                              item?.validationCheckedAt,
                                            )}`}
                                            <br />
                                            <span
                                              style={{ fontWeight: "bold" }}
                                            >
                                              Pass Points:-{" "}
                                            </span>
                                            {`${item?.passedPoints}/${item?.totalPoints}`}
                                            <br />
                                          </span>
                                          <Button
                                            onClick={() => {
                                              setValidationData(
                                                item?.validationResults,
                                              );
                                              setOpenValidationModal(true);
                                            }}
                                            className="withdraw-btn"
                                          >
                                            Bot Report
                                          </Button>
                                        </>
                                      ) : (
                                        "-"
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {item?.lockBy ? (
                                    <span>
                                      {`Ok by ${item.lockBy.name}`} <br />
                                      {`${formatDate(
                                        item.lockBy?.date,
                                      )} ${formatedTime(item.lockBy?.date)}`}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td>
                                  {item.status === "Cancel" ||
                                  item.status === "Rejected" ||
                                  item.status === "Reverse" ||
                                  item.status === "Failed" ? (
                                    ""
                                  ) : (
                                    <div>
                                      {item.checkBy ? (
                                        item.checkBy.status === true ? (
                                          <span>
                                            {`Ok by ${item.checkBy.name}`}{" "}
                                            <br />
                                            {`${formatDate(
                                              item.checkBy?.date,
                                            )} ${formatedTime(
                                              item.checkBy?.date,
                                            )}`}
                                          </span>
                                        ) : (
                                          <span>
                                            {`Not Ok by ${item.checkBy.name}`}{" "}
                                            <br />
                                            {`${formatDate(
                                              item.checkBy?.date,
                                            )} ${formatedTime(
                                              item.checkBy?.date,
                                            )}`}
                                          </span>
                                        )
                                      ) : (
                                        <>
                                          {!User.data.Responsibilities?.includes(
                                            Responsibilities.Disable_Withdrawals_Check,
                                          ) && (
                                            <>
                                              <span
                                                onClick={() =>
                                                  checkedBy(
                                                    item.transactionId,
                                                    "first",
                                                    true,
                                                  )
                                                }
                                              >
                                                <FontAwesomeIcon
                                                  className="fa fa-pencil-square icon-home icon-banner checkd"
                                                  icon={faSquareCheck}
                                                />
                                              </span>
                                              <span
                                                onClick={() =>
                                                  checkedBy(
                                                    item.transactionId,
                                                    "first",
                                                    false,
                                                  )
                                                }
                                              >
                                                <FontAwesomeIcon
                                                  className="fa fa-pencil-square icon-home icon-banner crossed"
                                                  icon={faRectangleXmark}
                                                />
                                              </span>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td>
                                  {User.data.Responsibilities?.includes(
                                    Responsibilities.View_Delay_Reason,
                                  ) && (
                                    <>
                                      <FormControl fullWidth>
                                        <InputLabel id="demo-simple-select-label">
                                          Select Reason
                                        </InputLabel>
                                        <Select
                                          labelId="demo-simple-select-label"
                                          id="demo-simple-select"
                                          value={selectedWithdrawDelayReason}
                                          label="Age"
                                          onChange={(e: any) =>
                                            handleWithdrawReasonSelect(
                                              e,
                                              item?.transactionId,
                                            )
                                          }
                                        >
                                          {Withdraw_Delay_Reasons?.map(
                                            (reason: any, index: any) => {
                                              return (
                                                <MenuItem value={reason}>
                                                  {reason}
                                                </MenuItem>
                                              );
                                            },
                                          )}
                                        </Select>
                                      </FormControl>
                                    </>
                                  )}
                                </td>
                                {/* new dealy code */}
                                <td>
                                  {User.data.Responsibilities?.includes(
                                    Responsibilities.View_Delay_Reason,
                                  ) && (
                                    <>
                                      <FormControl fullWidth>
                                        {item.delayReason && (
                                          <div
                                            style={{
                                              marginBottom: "10px",
                                              padding: "7px",
                                              border: "1px solid #3f51b5",
                                              borderRadius: "6px",
                                              background: "#f0f4ff",
                                              width: "fit-content",
                                              fontSize: "9px",
                                            }}
                                          >
                                            <div>
                                              <strong>Name:</strong>{" "}
                                              {item?.delayReason?.name || "-"}
                                            </div>
                                            <div>
                                              <strong>Reason:</strong>{" "}
                                              {item?.delayReason?.reason || "-"}
                                            </div>
                                            <div>
                                              <strong>Date:</strong>{" "}
                                              {item?.delayReason?.date
                                                ? new Date(
                                                    item.delayReason?.date,
                                                  ).toLocaleString()
                                                : "-"}
                                            </div>
                                            <div>
                                              <strong>User ID:</strong>{" "}
                                              {item?.delayReason?.userId || "-"}
                                            </div>
                                          </div>
                                        )}
                                      </FormControl>
                                    </>
                                  )}
                                </td>
                                <td>
                                  {item.status === "Cancel" ||
                                  item.status === "Rejected" ||
                                  item.status === "Reverse" ||
                                  item.status === "Failed" ? (
                                    ""
                                  ) : (
                                    <div>
                                      {item.crossCheckBy ? (
                                        <span>
                                          {item.crossCheckBy.status ? (
                                            <span>
                                              {`Ok by ${item.crossCheckBy.name}`}
                                              <br />
                                              {`${formatDate(
                                                item.crossCheckBy?.date,
                                              )} ${formatedTime(
                                                item.crossCheckBy?.date,
                                              )}`}
                                            </span>
                                          ) : (
                                            <span>
                                              {`Not Ok by ${item.crossCheckBy.name}`}
                                              <br />
                                              {`${formatDate(
                                                item.crossCheckBy?.date,
                                              )} ${formatedTime(
                                                item.crossCheckBy?.date,
                                              )}`}
                                            </span>
                                          )}
                                        </span>
                                      ) : item?.checkBy?.status &&
                                        !User.data.Responsibilities?.includes(
                                          Responsibilities.Disable_Withdrawals_Check,
                                        ) ? (
                                        <>
                                          <span
                                            onClick={() =>
                                              checkedBy(
                                                item.transactionId,
                                                "second",
                                                true,
                                              )
                                            }
                                          >
                                            <FontAwesomeIcon
                                              className="fa fa-pencil-square icon-home icon-banner checkd"
                                              icon={faSquareCheck}
                                            />
                                          </span>
                                          <span
                                            onClick={() =>
                                              checkedBy(
                                                item.transactionId,
                                                "second",
                                                false,
                                              )
                                            }
                                          >
                                            <FontAwesomeIcon
                                              className="fa fa-pencil-square icon-home icon-banner crossed"
                                              icon={faRectangleXmark}
                                            />
                                          </span>
                                        </>
                                      ) : null}
                                    </div>
                                  )}
                                </td>
                                {User?.data?.Responsibilities?.includes(
                                  Responsibilities.withdrawals_button, // !!
                                ) && (
                                  <>
                                    <td>
                                      {
                                        (item?.checkBy?.status &&
                                          item?.crossCheckBy?.status) ?
                                      
                                      <>
                                        {item?.status == "Lock" ||
                                        item?.status == "IN PROGRESS" ? (
                                          <>
                                            <button
                                              onClick={() =>
                                                handleunLock(
                                                  item?.transactionId,
                                                )
                                              }
                                              className="lock-btn"
                                            >
                                              UnLock
                                            </button>
                                            <Checkbox
                                              checked={checkedUnLockIds.includes(
                                                item?.transactionId,
                                              )} // Ensure correct checked state
                                              onChange={handleBulkUnLockCheckIds(
                                                item?.transactionId,
                                              )}
                                              color="primary"
                                              key={item.transactionId}
                                            />
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              className="lock-btn"
                                              onClick={() =>
                                                handleLock(item?.transactionId)
                                              }
                                            >
                                              Lock
                                            </button>
                                            <Checkbox
                                              checked={checkedLockIds.includes(
                                                item?.transactionId,
                                              )} // Ensure correct checked state
                                              onChange={handleBulkLockCheckIds(
                                                item?.transactionId,
                                              )}
                                              color="primary"
                                              key={item.transactionId}
                                            />
                                          </>
                                        )}
                                      </>
                                      :"-"}
                                    </td>

                                    <td
                                      style={{
                                        width: "100px",
                                        maxWidth: "100px",
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                      }}
                                    >
                                      <>
                                        {item.status === "Pending" ||
                                        item.status === "on hold" ||
                                        item.status === "IN PROGRESS" ? (
                                          <CustomSelect
                                            label="Select Gateway"
                                            value={
                                              Selected_Payment_Gateway_Indexes[
                                                Index
                                              ]
                                            }
                                            onChange={(newValue) =>
                                              Change_Payment_Gateway(
                                                newValue,
                                                Index,
                                              )
                                            }
                                            options={Payment_Gateways?.map(
                                              (gateway, index) => ({
                                                value: index,
                                                label: gateway,
                                              }),
                                            )}
                                          />
                                        ) : item.status?.toLowerCase() ==
                                          "approved" ? (
                                          `${item.withdrewalProviderName} - ${
                                            item.mid ? item.mid : item.status
                                          }`
                                        ) : (
                                          ""
                                        )}
                                      </>
                                    </td>
                                    {/* Hidden: Preferred Withdrawal Gateway cell (approved-deposit-withdrawal-report)
                                    <td className="px-4 py-3">
                                      <div className="flex flex-col gap-2">
                                        {Array.isArray(item?.updatedData) &&
                                        item.updatedData?.length > 0
                                          ? item.updatedData?.map(
                                              (v: any, index: number) => (
                                                <div
                                                  key={index}
                                                  className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-black-200 bg-black-50 px-3 py-2 text-sm"
                                                >
                                                  <span
                                                    style={{
                                                      fontWeight: "bold",
                                                      color: "#000",
                                                    }}
                                                  >
                                                    {v?.mid ?? "zappay"}
                                                  </span>

                                                  <span className="text-red-600 font-medium">
                                                    <span
                                                      style={{
                                                        fontWeight: "bold",
                                                        color: "green",
                                                      }}
                                                    >
                                                      {` D:- ₹${v?.depositAmount?.toLocaleString()}`}{" "}
                                                    </span>
                                                    ({v?.depositCount})
                                                  </span>

                                                  <span className="text-red-600 font-medium">
                                                    <span
                                                      style={{
                                                        fontWeight: "bold",
                                                        color: "red",
                                                      }}
                                                    >
                                                      {` W:- ₹${v?.withdrawalAmount?.toLocaleString()}`}{" "}
                                                    </span>
                                                    ({v?.withdrawalCount})
                                                  </span>
                                                </div>
                                              ),
                                            )
                                          : item?.updatedData?.length === 0 && (
                                              <div
                                                key={`emptyReq`}
                                                className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-black-200 bg-black-50 px-3 py-2 text-sm"
                                              >
                                                <span
                                                  style={{
                                                    fontWeight: "bold",
                                                    color: "#000",
                                                  }}
                                                >
                                                  {"zappay"}
                                                </span>
                                              </div>
                                            )}
                                      </div>
                                    </td>
                                    */}
                                    <td>
                                      {User?.data.Responsibilities.includes(
                                        Responsibilities.View_Reverse,
                                      ) &&
                                        item.status?.toLowerCase() !==
                                          "cancel" && (
                                          <span>
                                            <Button
                                              onClick={() =>
                                                handleOpenPopUp(
                                                  item.transactionId,
                                                  "Reverse",
                                                  item.dp_id,
                                                )
                                              }
                                              className="withdraw-btn"
                                              variant="contained"
                                              // disabled={
                                              // 	(item.status === "Reverse" || item.status === "Rejected") ||
                                              // 	(item.status !== "on hold" && !item.checkBy?.status && !item.crossCheckBy?.status)
                                              // }
                                            >
                                              Reverse
                                            </Button>
                                          </span>
                                        )}
                                    </td>
                                    {/* //testing */}
                                    {User?.data?.Responsibilities?.includes(
                                      Responsibilities.View_Reject,
                                    ) === true && (
                                      <td>
                                        {User.data.Responsibilities.includes(
                                          Responsibilities.View_Reject,
                                        ) &&
                                        ((item?.checkBy?.status &&
                                          item?.crossCheckBy?.status) ||
                                          item.status == "on hold" ||
                                          item.status == "Processing" ||
                                          item.status == "IN PROGRESS" ||
                                          item.status == "true") ? (
                                          <span>
                                            <Button
                                              onClick={() =>
                                                handleOpenPopUp(
                                                  item.transactionId,
                                                  "Rejected",
                                                  item.dp_id,
                                                )
                                              }
                                              className="btn-withdraw"
                                              variant="contained"
                                              disabled={
                                                (!item.checkBy?.status &&
                                                  !item.crossCheckBy?.status &&
                                                  item.status !== "on hold") ||
                                                item.status === "Reverse" ||
                                                item.status === "Approved" ||
                                                item.status === "Rejected"
                                              }
                                            >
                                              Reject
                                            </Button>
                                          </span>
                                        ) : (
                                          <span>
                                            <Button
                                              onClick={() =>
                                                handleOpenPopUp(
                                                  item.transactionId,
                                                  "Rejected",
                                                  item.dp_id,
                                                )
                                              }
                                              className={`btn-withdraw ${
                                                item.status?.toLowerCase() ==
                                                "cancel"
                                                  ? "disabled_"
                                                  : ""
                                              }`}
                                              variant="contained"
                                              disabled={
                                                item.checkBy?.status &&
                                                item.status?.toLowerCase() ==
                                                  "cancel"
                                              }
                                            >
                                              Reject
                                            </Button>
                                          </span>
                                        )}
                                      </td>
                                    )}
                                    <td>
                                      <>
                                        {item?.status == "IN PROGRESS" ||
                                        (item?.status == "Lock" &&
                                          item?.checkBy?.status &&
                                          item?.crossCheckBy?.status) ? (
                                          <>
                                            {item.status === "Cancel" ? (
                                              ""
                                            ) : (
                                              <div
                                                style={{
                                                  display: "grid",
                                                  gridTemplateColumns:
                                                    "repeat(3, 1fr)",
                                                  gap: "10px",
                                                  width: "100%",
                                                }}
                                              >
                                                <Button
                                                  onClick={() =>
                                                    handleOpenPopUp(
                                                      item.transactionId,
                                                      "Approved",
                                                      item.dp_id,
                                                    )
                                                  }
                                                  className="btn-withdraw"
                                                  variant="contained"
                                                >
                                                  Approve
                                                </Button>

                                                <Button
                                                  onClick={() =>
                                                    handleOpenPopUp(
                                                      item.transactionId,
                                                      "Manual Approved",
                                                      item.dp_id,
                                                    )
                                                  }
                                                  className="btn-withdraw"
                                                  variant="contained"
                                                >
                                                  Manual
                                                </Button>

                                                <Button
                                                  onClick={() =>
                                                    handleQRCodeData(item)
                                                  }
                                                  className="btn-withdraw"
                                                  variant="contained"
                                                >
                                                  QR Code
                                                </Button>
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <></>
                                        )}
                                      </>
                                    </td>
                                    <td>
                                      <>
                                        {(item?.checkBy?.status &&
                                          item?.crossCheckBy?.status) ||
                                        item.status == "on hold" ||
                                        item.status == "Processing" ||
                                        item.status == "IN PROGRESS" ? (
                                          <>
                                            <span>
                                              <Button
                                                onClick={() =>
                                                  handleOpenPopUp(
                                                    item.transactionId,
                                                    "Approved",
                                                    item.dp_id,
                                                  )
                                                }
                                                className="btn-withdraw"
                                                variant="contained"
                                                disabled={
                                                  (!item.checkBy?.status &&
                                                    !item.crossCheckBy
                                                      ?.status &&
                                                    item.status ===
                                                      "on hold") ||
                                                  item.status === "Reverse" ||
                                                  item.status === "Approved" ||
                                                  item.status === "Rejected"
                                                }
                                              >
                                                Approve
                                              </Button>

                                              <Checkbox
                                                checked={Boolean(
                                                  checkedBulkApproveIds[
                                                    item._id
                                                  ],
                                                )} // Use `_id` for correct checking
                                                onChange={handleBulkApproveCheckIds(
                                                  item,
                                                )}
                                                color="primary"
                                                key={item._id}
                                              />
                                            </span>
                                          </>
                                        ) : (
                                          ""
                                        )}
                                      </>
                                      {/* )} */}
                                    </td>
                                    <td>
                                      {/* {!User.data.Responsibilities.includes(
                                        Responsibilities.withdrawals_button
                                      ) && ( */}
                                      <>
                                        {(item?.checkBy?.status &&
                                          item?.crossCheckBy?.status) ||
                                        item.status == '"Processing' ||
                                        item.status == "Failed" ? (
                                          <>
                                            <span>
                                              <Button
                                                // onClick={() => handleOpenPopUp(item.transactionId, "Approved", item.dp_id)}
                                                className="btn-withdraw"
                                                variant="contained"
                                                // disabled={(!item.checkBy?.status && !item.crossCheckBy?.status && item.status === "on hold") || item.status === "Reverse" || item.status === "Approved" || item.status === "Rejected"}
                                              >
                                                Approve
                                              </Button>

                                              <Checkbox
                                                checked={Boolean(
                                                  checkedBulkManualApproveIds[
                                                    item._id
                                                  ],
                                                )} // Use `_id` for correct checking
                                                onChange={handleBulkManualApproveCheckIds(
                                                  item,
                                                )}
                                                color="primary"
                                                key={item._id}
                                              />
                                            </span>
                                          </>
                                        ) : (
                                          ""
                                        )}
                                      </>
                                      {/* )} */}
                                    </td>
                                  </>
                                )}
                                {/* manual approved bugs here */}
                                <td>
                                  {item.action
                                    ? `${item.action?.status} by ${item.action?.name}`
                                    : ""}{" "}
                                  <br />
                                  <p style={{ fontSize: "0.9rem" }}>
                                    {formatDate(item?.updatedOn) +
                                      " | " +
                                      formatedTime(item?.updatedOn)}
                                  </p>
                                </td>
                                <td
                                  style={{
                                    backgroundColor:
                                      item.pnl >= 0 ? "#84d184" : "#ff7e7e",
                                  }}
                                >
                                  {Math.round(item.pnl).toFixed(2)}
                                </td>
                                <td
                                  style={{
                                    backgroundColor:
                                      item.afterWithdrawalPnl >= 0
                                        ? "#84d184"
                                        : "#ff7e7e",
                                  }}
                                >
                                  {Math.round(item.afterWithdrawalPnl).toFixed(
                                    2,
                                  )}
                                </td>
                              </tr>
                            ));
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
                          onChange={(Event, New_Page) => {
                            setCurrentPage(New_Page);
                            sessionStorage.setItem(key, New_Page?.toString());
                          }}
                        />
                      </Stack>
                    </ul>
                  </div>
                </div>
                <AddBenePopup
                  open={showAddBenePopup}
                  onClose={handleCloseAddBenePopup}
                  userId={dpIdPopup}
                  transactionId={orderIdPopup}
                  bankOptions={BeneAccArray}
                  beneficiaryAccounts={beneficiaryAccounts}
                  selectedBanks={beneName}
                  onSelect={handleBeneName}
                  onSubmit={handleUpdateBeneName}
                  onBeneficiaryRemoved={handleBeneficiaryRemoved}
                  loading={loading}
                  error={beneNameError}
                  helperText={beneNameHelperText}
                />
                <div>
                  <Dialog
                    open={showQRPopup}
                    onClose={() => setShowQRPopup(false)}
                  >
                    <DialogContent
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        gap: "12px",
                      }}
                    >
                      <UpiQr
                        pa={QRCodeData?.upiId}
                        am={QRCodeData?.amount}
                        tn={`Note:${QRCodeData?.accountHolderName?.slice(0, 6)}-${QRCodeData?.dp_id?.slice(-6)}`}
                        tr={`ORD-${Date.now()}`}
                      />
                      <h5>Select Gateway Name:</h5>
                      <select
                        value={gatewayName}
                        onChange={handleGatewayChange}
                        style={{
                          width: "250px",
                          padding: "10px",
                          borderRadius: "6px",
                          fontSize: "16px",
                        }}
                      >
                        <option value="">--Choose--</option>
                        <option value="bramhadev">Bramhadev</option>
                        <option value="jk Bank">J&K Bank</option>
                        <option value="personal">Personal</option>
                        <option value="kotak">Kotak</option>
                        <option value="OFS-HDFC">OFS-HDFC</option>
                        <option value="OFS-AXIS">OFS-AXIS</option>
                        <option value="axis">Axis</option>
                        <option value="payok">Pay Ok</option>
                        <option value="uco">Uco</option>
                        <option value="ansin-ecommerce-JK">
                          Ansin-Ecommerce-JK
                        </option>
                        <option value="OFS-ansin">OFS-ansin</option>
                        <option value="digitech">Digitech</option>
                        <option value="rpf">Royal Pets</option>
                        <option value="shyam-trading">SHYAM-TRADING</option>
                      </select>

                      <h5>Select Mid Name:</h5>
                      <select
                        value={selectMidName}
                        onChange={(e) => setSelectMidName(e.target.value)}
                        style={{
                          width: "250px",
                          padding: "10px",
                          borderRadius: "6px",
                          fontSize: "16px",
                        }}
                      >
                        <option value="">--Choose--</option>

                        {midArray?.map((mid: any, index: any) => (
                          <option key={index} value={mid?.mid}>
                            {mid?.mid}
                          </option>
                        ))}
                      </select>

                      <div>
                        <Button
                          onClick={() => {
                            setShowQRPopup(false);
                            handleSubmit();
                          }}
                          className="btn-popup"
                          variant="outlined"
                          type="submit"
                          color="primary"
                          disabled={loading}
                        >
                          Submit to Approve
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {/* Bulk Manual Approve */}
                <div>
                  <Dialog
                    open={bulkManualApprovePopup}
                    onClose={() => setBulkManualApprovePopup(false)}
                  >
                    <DialogContent
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        gap: "12px",
                      }}
                    >
                      <h5>Select Gateway Name:</h5>
                      <select
                        value={gatewayName}
                        onChange={handleGatewayChange}
                        style={{
                          width: "250px",
                          padding: "10px",
                          borderRadius: "6px",
                          fontSize: "16px",
                        }}
                      >
                        <option value="bramhadev">Bramhadev</option>
                        <option value="jk Bank">J&K Bank</option>
                        <option value="personal">Personal</option>
                        <option value="kotak">Kotak</option>
                        <option value="OFS-HDFC">OFS-HDFC</option>
                        <option value="OFS-AXIS">OFS-AXIS</option>
                        <option value="axis">Axis</option>
                        <option value="payok">Pay Ok</option>
                        <option value="uco">Uco</option>
                        <option value="ansin-ecommerce-JK">
                          Ansin-Ecommerce-JK
                        </option>
                        <option value="OFS-ansin">OFS-ansin</option>
                        <option value="digitech">Digitech</option>
                        <option value="rpf">Royal Pets</option>
                        <option value="shyam-trading">SHYAM-TRADING</option>
                      </select>

                      <h5>Select Mid Name:</h5>
                      <select
                        value={selectMidName}
                        onChange={(e) => setSelectMidName(e.target.value)}
                        style={{
                          width: "250px",
                          padding: "10px",
                          borderRadius: "6px",
                          fontSize: "16px",
                        }}
                      >
                        <option value="">--Choose--</option>

                        {midArray?.map((mid: any, index: any) => (
                          <option key={index} value={mid?.mid}>
                            {mid?.mid}
                          </option>
                        ))}
                      </select>

                      <div>
                        <Button
                          onClick={() => {
                            setBulkManualApprovePopup(false);
                            handleBulkManualApproveSubmit();
                          }}
                          className="btn-popup"
                          variant="outlined"
                          type="submit"
                          color="primary"
                          disabled={loading}
                        >
                          Submit to Approve
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {/* Footer */}
                <footer className="footer">
                  <div className="container-fluid">
                    <div className="row align-items-center justify-content-lg-between">
                      <div className="col-lg-6 mb-lg-0  ">
                        <div className="copyright text-center text-sm text-muted text-lg-start">
                          © fairbets.co
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <ul className="nav nav-footer justify-content-center justify-content-lg-end">
                          <li className="nav-item">
                            <a className="nav-link text-muted" target="_blank">
                              Home
                            </a>
                          </li>
                          <li className="nav-item">
                            <a className="nav-link text-muted" target="_blank">
                              About Us
                            </a>
                          </li>
                          <li className="nav-item">
                            <a className="nav-link text-muted" target="_blank">
                              Blog
                            </a>
                          </li>
                          <li className="nav-item">
                            <a
                              className="nav-link pe-0 text-muted"
                              target="_blank"
                            >
                              License
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <ValidationModal
                    open={openValidationModal}
                    onClose={() => setOpenValidationModal(false)}
                    data={validationData}
                  />
                </footer>
              </div>
            </div>
          </main>

          <BeneModal
            open={openCreateBene}
            onClose={() => setOpenCreateBene(false)}
            initialBanks={BeneAccArray ?? []}
            onSuccess={getBeneAccList}
          />
        </div>
      )}
    </>
  );
}

export default Withdraw;
