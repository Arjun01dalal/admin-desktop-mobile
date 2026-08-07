import React, {
  useContext,
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useMemo,
  useRef,
} from "react";
import "../../../../Css/style.css";
import "../../../../Css/table.css";
import "../../../../Css/users.css";
import "../Deposit/Deposit.css";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import axios from "axios";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { dateTime, formatedTime } from "../../../../utils/utility";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../../../../Components/Loader/Loader";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  Stack,
  Autocomplete,
  Checkbox,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { decryptData } from "../../../../utils/decryptData";
import { encryptData } from "../../../../utils/encryptData";
import { User_Context } from "../../../../Contexts/User";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import SearchBar from "../../../../Components/SearchBox/Search";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import DepositWithdrawCard from "../../../../Components/Statistics/DepositWithdrawCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilSquare } from "@fortawesome/free-solid-svg-icons";
import ExcelExport from "../../../../Excel/ExcelExport";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
} from "@material-ui/core";

import Button from "@mui/material/Button";
import { TextField } from "@material-ui/core";
import {
  Client_Names,
  depositStates,
  Responsibilities,
} from "../../../../Configuration/Enums";
import { isArray, set } from "lodash";
import { Refresh } from "@mui/icons-material";
import useLocation from "../../../../Hooks/useLocation";
import { API_Handler } from "../../../../API/API_Handler";
import Reusable_Input from "../../../../Components/InputField/InputField";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import CustomInputField from "./CustomInputField";
import UpdateMidModal, { SelectedOrderUpdate } from "./UpdateMidModal";
import OtpModal from "../../../../Components/OTPInput/OtpModal";
import { faSquareCheck } from "@fortawesome/free-solid-svg-icons";
import { isUtrSlipFile, readUtrFromSlip } from "./extractUtr";

interface Deposit {
  userName: string;
  _id: string;
  userId: string;
  amount: number;
  orderId: string;
  status: string;
  type: string;
  createdOn: string;
  reason: string;
  updatedOn: string;
  userCity: string;
  userState: string;
  __v: number;
  txid: string;
  paymentGatewayName: string;
  mid: string;
  userMobile: string;
  kyc: boolean;
  userBankName: string;
  accountNumber: string;
  aadhaarNumber: string;
  clientName: string;
  paymentType: string;
  ifsc?: string;
  updatedTime: string;
  orderKeyID: string;
  updatedByName: string;
  upiId?: string;
  userDepositUpiIds?: any;
  crossCheckBy?: any;
  checkBy?: any;
  lastActivity?: any;
}

interface DepositCard {
  depositeApprovedData: {
    count: number;
    totalAmount: number;
  };
  depositePendingData: {
    count: number;
    totalAmount: number;
  };
  totalOnholdWithdrawalData: {
    count: number;
    totalAmount: number;
  };
  totalApprovedWithdrawalData: {
    count: number;
    totalAmount: number;
  };
  totalPendingWithdrawalData: {
    count: number;
    totalAmount: number;
  };
  totalReverseWithdrawalData: {
    count: number;
    totalAmount: number;
  };
  totalWithdrawalRejected: {
    count: number;
    totalAmount: number;
  };
}

interface DepositData {
  depositApprovedTotal: number;
  depositApprovedCount: number;
  depositRejectedTotal: number;
  depositRejectedCount: number;
  depositPendingTotal: number;
  depositPendingCount: number;
}
interface SubAdmin {
  _id: string;
  name: string;
  totalApprovedCount: number;
  totalApprovedAmount: number;
  totalRejectedCount: number;
  totalRejectedAmount: number;
  totalReversedCount: number;
  totalReversedAmount: number;
  totalOnholdCount: number;
  totalOnholdAmount: number;
  exchangeCredit: number;
  exchangeDebit: number;
  casinoCredit: number;
  casinoDebit: number;
  wacCredit: number;
  wacDebit: number;
  bonusCredit: number;
  bonusDebit: number;
  scannerDepositCredit: number;
  scannerDepositDebit: number;
  depositFailureCredit: number;
  // depositFailureDebit: number,
  falconCredit: number;
  falconDebit: number;
  otherCredit: number;
  otherDebit: number;
  exchangeCreditCount: number;
  exchangeDebitCount: number;
  casinoCreditCount: number;
  casinoDebitCount: number;
  wacCreditCount: number;
  wacDebitCount: number;
  bonusCreditCount: number;
  bonusDebitCount: number;
  scannerDepositCreditCount: number;
  scannerDepositDebitCount: number;
  depositFailureCreditCount: number;
  // depositFailureDebitCount: number,
  falconCreditCount: number;
  falconDebitCount: number;
  otherCreditCount: number;
  otherDebitCount: number;
  manualCredit: number;
  manualCreditCount: number;
  manualDebit: number;
  manualDebitCount: number;
  qtechCredit: number;
  qtechCreditCount: number;
  qtechDebit: number;
  qtechDebitCount: number;
  sattaMatkaCredit: number;
  sattaMatkaCreditCount: number;
  sattaMatkaDebit: number;
  sattaMatkaDebitCount: number;
  depositRejectedAmountIn: number;
  depositRejectedCountIn: number;
  WithdrawalData: {
    totalCanceledAmount: number;
    totalCanceledCount: number;
    totalApprovedAmount: number;
    totalApprovedCount: number;
    totalPendingAmount: number;
    totalPendingCount: number;
    totalOnholdAmount: number;
    totalOnholdCount: number;
    totalRejectedAmount: number;
    totalRejectedCount: number;
    totalReversedAmount: number;
    totalReversedCount: number;
    todaysTotalApprovedAmount: number;
    todaysTotalApprovedCount: number;
    previousTotalApprovedAmount: number;
    previousTotalApprovedCount: number;
  };
  nonPerformingUserDetail: {
    totalAmount: number;
    totalCount: number;
  };
  uniquePendingDetail: {
    pendingCount: number;
    pendingAmount: number;
  };
  depositData: {
    depositApprovedTotal: number;
    depositApprovedCount: number;
    depositPendingTotal: number;
    depositPendingCount: number;
    depositRejectedTotal: number;
    depositRejectedCount: number;
  };
  coinData: {
    totalexchangeCredit: number;
    totalexchangeDebit: number;
    totalexchangeCreditCount: number;
    totalexchangeDebitCount: number;
    totalmanualCredit: number;
    totalmanualDebit: number;
    totalmanualCreditCount: number;
    totalmanualDebitCount: number;
    totalcasinoCredit: number;
    totalcasinoDebit: number;
    totalcasinoCreditCount: number;
    totalcasinoDebitCount: number;
    totalwacCredit: number;
    totalwacDebit: number;
    totalwacCreditCount: number;
    totalwacDebitCount: number;
    totalbonusCredit: number;
    totalbonusDebit: number;
    totalbonusCreditCount: number;
    totalbonusDebitCount: number;
    totalscannerDepositCredit: number;
    totalscannerDepositDebit: number;
    totalscannerDepositCreditCount: number;
    totalscannerDepositDebitCount: number;
    totaldepositFailureCredit: number;
    totaldepositFailureDebit: number;
    totaldepositFailureCreditCount: number;
    totaldepositFailureDebitCount: number;
    totalfalconCredit: number;
    totalfalconDebit: number;
    totalfalconCreditCount: number;
    totalfalconDebitCount: number;
    totalotherCredit: number;
    totalotherDebit: number;
    totalotherCreditCount: number;
    totalotherDebitCount: number;
    totalqtechCredit: number;
    totalqtechCreditCount: number;
    totalqtechDebit: number;
    totalqtechDebitCount: number;
    totalsattaMatkaCredit: number;
    totalsattaMatkaCreditCount: number;
    totalsattaMatkaDebit: number;
    totalsattaMatkaDebitCount: number;
  };
  depositUserDetail: {
    oldUserDepositSum: number;
    oldUserDepositCount: number;
    newUserDepositSum: number;
    newUserDepositCount: number;
  };
}

function Deposit() {
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
  const [rejectId, setRejectId] = useState<string>("");
  const [selectdate, setSelectDate] = useState(
    new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [depositData, setDepositData] = useState<Deposit[]>([]);
  const [storedDepositData, setStoredDepositData] = useState<Deposit[]>([]);
  const [depositCardData, setDepositCardData] = useState<DepositCard>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { User } = useContext(User_Context);
  const [searchClientOrderId, setSearchClientOrderId] = useState("");
  const [searchUserId, setSearchUserId] = useState("");
  const [searchUpiId, setSearchUpiId] = useState("");
  const [updateTextVal, setUpdateTextVal] = useState<string>("");
  const [updateTextError, setUpdateTextError] = useState<boolean>(false);

  const [searchUserName, setSearchUserName] = useState<string>(() => {
    const savedName = localStorage.getItem("searchUserName");
    return savedName ? savedName : "";
  });

  const [searchUserAmount, setSearchUserAmount] = useState<string>(() => {
    const savedName = localStorage.getItem("searchUserAmount");
    return savedName ? savedName : "";
  });

  const [searchUserOrderId, setSearchUserOrderId] = useState<string>("");
  const [searchUserMobile, setSearchUserMobile] = useState<string>(() => {
    const savedName = localStorage.getItem("searchUserMob");
    return savedName ? savedName : "";
  });
  const [searchUserStatus, setSearchUserStatus] = useState<string>(() => {
    let saved = localStorage.getItem("searchUserStatus");
    return saved ? saved : "";
  });
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const savedItemsPerPage = localStorage.getItem("depositItemsPerPage");
    return savedItemsPerPage ? parseInt(savedItemsPerPage, 10) : 10;
  });
  const [openPopup, setOpenPopup] = useState(false);
  const [openRejectPopup, setOpenRejectPopup] = useState(false);
  const [depositItem, setDepositItem] = useState<Deposit>();
  const [editedAmount, setEditedAmount] = useState<number>(0);
  const [utrNo, setUtrNo] = useState<string>("");
  const [utrReading, setUtrReading] = useState<boolean>(false);
  const [utrSlipName, setUtrSlipName] = useState<string>("");
  const utrFileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDialogMid, setSelectedDialogMid] = useState<string>("");
  const [selectedPayinGatewayName, setSelectedPayinGatewayName] =
    useState<string>("");
  const [totalUser, setTotalUser] = useState<number>(10);
  const [fetchAllData, setFetchAllData] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejectReasonError, setRejectReasonError] = useState<boolean>(false);
  const [rejectReasonHelperText, setRejectReasonHelperText] =
    useState<string>("");
  const [totalDepositData, setTotalDepositData] = useState<{
    [key: string]: DepositData;
  }>({});
  const [fundId, setFundId] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<SubAdmin>();
  const [requestType, setRequestType] = useState("automatic");
  const [paymentGetwayNames, setPaymentGatewayNames] = useState([]);
  const [payInGatewayName, setPayinGatewayName] = useState([]);
  const [selectedGateway, setSelectedGateWay] = useState<any>("");
  const [searchDepositUserCity, setSearchDepositUserCity] = useState<string>(
    () => {
      const savedName = localStorage.getItem("searchDepositCity");
      return savedName ? savedName : "";
    },
  );
  const [userBankName, setUserBankName] = useState<string>(() => {
    const savedName = localStorage.getItem("userBankName");
    return savedName ? savedName : "";
  });

  const [searchDepositUserState, setSearchDepositUserState] = useState<string>(
    () => {
      const savedName = localStorage.getItem("searchDepositState");
      return savedName ? savedName : "";
    },
  );
  const [selectedReason, setSelectedReason] = useState("");
  const [cities, setCities] = useState<Cities>({});
  const [states, setStates] = useState([]);

  const [searchAadharNo, setSearchAdharNo] = useState(() => {
    const savedName = localStorage.getItem("searchDepositAadharNo");
    return savedName ? savedName : "";
  });
  const [searchAccNo, setSearchAccNo] = useState(() => {
    const savedName = localStorage.getItem("searchDepositAccNo");
    return savedName ? savedName : "";
  });
  const [showUpdateFieldPopup, setShowUpdateFieldPopup] =
    useState<boolean>(false);
  const [updateType, setUpdateType] = useState<string>("");
  const [id, setId] = useState<string>("");

  const [appClientName, setAppClientName] = useState("");
  const [scannerAppClientName, setScannerAppClientName] = useState("");
  const [donwloadModalShown, setDownloadModalShown] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<SelectedOrderUpdate[]>(
    [],
  );
  const [updateMidModalOpen, setUpdateMidModalOpen] = useState(false);
  const locationInfo = useLocation();
  const [address, setAddress] = useState<any>({});
  const Local_Role = localStorage.getItem("role");
  const Filtered_Client_Names: any =
    Local_Role == "cheacker" || Local_Role == "user_coin"
      ? Client_Names
      : User.data?.clientName
        ? User.data.clientName
        : User.data?.allotedApps
          ? User.data.allotedApps
          : Client_Names;
  const canUpdateDepositMid = User?.data?.Responsibilities?.includes(
    Responsibilities.update_deposit_mid,
  );

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

  const Handle_App_Client_Name = (event: SelectChangeEvent<string>) => {
    console.log("selected client name", event.target.value);
    setAppClientName(event.target.value);
  };

  const Handle_Scanner_App_Client_Name = (event: SelectChangeEvent<string>) => {
    setScannerAppClientName(event.target.value);
  };

  // get all unique pending deposit data
  interface uniquePendingType {
    pendingCount: number;
    pendingAmount: number;
  }

  const [uniquePendingDeposit, setUniquePendingDeposit] =
    useState<uniquePendingType>();
  const navigate = useNavigate();

  const handleSearchUserName = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserName(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("searchUserName", event.target.value);
  };

  const handleSearchUserAmount = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserAmount(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("searchUserAmount", event.target.value);
  };

  const handleSearchUserOrderId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserOrderId(event.target.value);
    setCurrentPage(1);
  };

  const handleSearchUserMob = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserMobile(event.target.value);
    setCurrentPage(1);
    localStorage.setItem("searchUserMob", event.target.value);
  };

  const handleRejectReason = (event: ChangeEvent<HTMLInputElement>) => {
    setRejectReason(event.target.value);
  };

  const rejectDeposit = (event?: any) => {
    event.preventDefault();

    if (!rejectReason) {
      setRejectReasonError(true);
      setRejectReasonHelperText("Please enter reason");
    } else {
      setLoading(true);
      let data = {
        transactionId: rejectId,
        status: "Rejected",
        updatedBy: {
          _id: User.data._id,
          name: User.data.name,
        },
        reason: rejectReason,
      };
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/transaction/update-deposit-status`,
        headers: {
          Authorization: `Bearer ${User.token}`,
        },
        data: { token: encryptData(data) },
      };

      axios
        .request(config)
        .then((response) => {
          setLoading(false);
          setOpenRejectPopup(false);
          setRejectReason("");
          setRejectReasonError(false);
          toast("Amount Rejected Successfully!");

          setDepositData((prevData) =>
            prevData.map((item) =>
              item.orderId === rejectId
                ? { ...item, status: "Rejected" }
                : item,
            ),
          );
        })
        .catch((error: any) => {
          setLoading(false);
          toast("Error please try again after sometime");
        });
    }
  };
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
      // const currentDate = new Date().toISOString().split('T')[0];
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
          setTotalDepositData(response.data.data.payload.depositData);
          setTotalAmount(response.data.data.payload);
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
  };

  let deposit = "deposit";

  const handlePerPage = (newValue: any) => {
    setItemsPerPage(newValue);
    localStorage.setItem("depositItemsPerPage", newValue?.toString());
  };

  const filterTransactionData = (e: any) => {
    const id = e.target.id;
    setFundId(id);
    if (id === "alldata") {
      setStartDate("");
      getFundRequests();
      setEndDate("");
      setCurrentPage(1);
      setFetchAllData("test");
    } else {
      setFetchAllData("");
      filterTransaction();
      getFundRequests();
      setCurrentPage(1);
    }
  };
  const filterTransaction = (event?: any) => {
    setLoading(true);
    let filter: {
      userName?: string;
      userCity?: string;
      userState?: string;
      amount?: number;
      orderId?: string;
      userMobile?: string;
      status?: string;
      accountNumber?: string;
      aadhaarNumber?: string;
      clientName?: string;
      paymentGatewayName?: string;
      mid?: "";
      orderKeyID?: string;
      userBankName?: string;
      userId?: string;
      upiId?: string;
    } = {};
    if (searchUserName) {
      filter.userName = searchUserName;
    }
    if (searchUserAmount) {
      filter.amount = parseFloat(searchUserAmount);
    }
    if (searchUserOrderId) {
      filter.orderId = searchUserOrderId;
    }
    if (searchUserMobile) {
      filter.userMobile = searchUserMobile;
    }
    if (searchUserStatus) {
      filter.status = searchUserStatus;
    }
    if (searchDepositUserCity) {
      filter.userCity = searchDepositUserCity;
    }
    if (searchDepositUserState) {
      filter.userState = searchDepositUserState;
    }
    if (appClientName) {
      filter.clientName = appClientName;
    }
    if (userBankName) {
      filter.userBankName = userBankName;
    }
    if (searchUserId) {
      filter.userId = searchUserId;
    }
    if (selectedGateway) {
      // filter.paymentGatewayName = selectedGateway; //selectedGateway.name;
      filter.mid = selectedGateway?.mid; //mid
    }
    if (searchClientOrderId) {
      filter.orderKeyID = searchClientOrderId;
    }
    if (searchUpiId) {
      filter.upiId = searchUpiId.trim();
    }
    let stateWiseFilter: Record<string, string[]> = {};
    const appWithState = User?.data?.appWithState as Record<string, string[]>;

    if (appClientName && appWithState && appWithState[appClientName]) {
      // If a specific app is selected, keep its state(s)
      stateWiseFilter[appClientName] = appWithState[appClientName];
    } else if (appWithState) {
      // If no app is selected, combine all states for all apps
      Object?.entries(appWithState)?.forEach(([key, states]) => {
        stateWiseFilter[key] = [...states];
      });
    }
    const token = localStorage.getItem("token");
    let data: any = {};
    if (fetchAllData) {
      data = {
        type: deposit,
        itemsPerPage: itemsPerPage,
        pageNo: currentPage,
        filter: filter,
      };
    } else if (startDate && endDate) {
      data = {
        type: deposit,
        itemsPerPage: itemsPerPage,
        pageNo: currentPage,
        filter: filter,
        startDate: dateTime(startDate),
        endDate: dateTime(endDate),

        // app: User?.data?.allotedApps
      };
    } else {
      // const currentDate = new Date().toISOString().split('T')[0];
      const currentDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      data = {
        type: deposit,
        itemsPerPage: itemsPerPage,
        pageNo: currentPage,
        filter: filter,
        startDate: dateTime(currentDate),
        endDate: dateTime(currentDate),
      };
    }
    console.log("payload data from get deposit------->", data);

    if (stateWiseFilter && Object.keys(stateWiseFilter).length > 0) {
      data.appWithState = stateWiseFilter;
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
          console.log("deposit data", response.data.data);
          setTotalUser(response.data.data.payload.total);
          let data = response.data.data.payload.items.length <= 0;
          if (data) {
            toast("No deposits available for todays date");
          }
          setDepositCardData(response.data.data.payload);
          setStoredDepositData(response.data.data.payload.items);
          const items = response.data.data.payload.items ?? [];
          const states =
            User?.data?.accessibleStates?.map((s: string) => s.toLowerCase()) ??
            [];
          setDepositData(
            states.length === 0
              ? items
              : items.filter((item: any) =>
                  states.includes(
                    (item?.state || item?.userState || "").toLowerCase(),
                  ),
                ),
          );
          //setDepositData(response.data.data.payload.items);
          console.log("deposit data", response.data.data.payload.items);
          setTotalPages(response.data.data.payload.totalPages);
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
  };

  const formatDate = (date: any) => {
    //   const formatDate:any = new Date(date)
    // .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    //   const day = formatDate?.getDate().toString().padStart(2, "0");
    //   const month = (formatDate?.getMonth() + 1).toString().padStart(2, "0");
    //   const year = formatDate?.getFullYear().toString();

    //   return `${day}-${month}-${year}`;
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

  const formattedDate = (timestamp: any) => formatDate(new Date(timestamp));

  const openEditDialog = (item: Deposit) => {
    setDepositItem(item);
    setEditedAmount(item.amount);
    setSelectedDialogMid(item?.mid || "");
    setSelectedPayinGatewayName(item?.paymentGatewayName);
    setUtrNo("");
    setUtrSlipName("");
    setOpenPopup(true);
  };

  const updatePaymentGatewayName = async () => {
    let token = localStorage.getItem("token");
    let data: any = {
      _id: depositItem?._id,
      paymentGatewayName: selectedPayinGatewayName,
    };

    setLoading(true);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/transaction/updatePaymentGatewayName`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(data) },
    };

    await axios
      .request(config)
      .then(async (response) => {
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        console.log(error);
      });
  };

  const submitManualSettle = (utrOverride?: string, event?: any) => {
    if (
      locationInfo?.coords?.latitude &&
      locationInfo?.coords?.longitude &&
      address?.state &&
      address?.city
    ) {
      event?.preventDefault?.();
      console.log(selectedReason);
      const token = localStorage.getItem("token");
      const utrValue = utrOverride ?? utrNo;
      let dummy = {
        userId: depositItem?.userId,
        balance: depositItem?.amount,
        updatedBy: {
          name: User.data.name,
          _id: User.data._id,
        },
        reason: selectedReason,
        remark: `Deposite failure of ${depositItem?.userName} through ${depositItem?.paymentGatewayName} pay with order id ${depositItem?.orderId} and mobile no ${depositItem?.userMobile}`,
        tag: "credit",
        orderId: depositItem?.orderId,
        mid: selectedDialogMid || depositItem?.mid,
      };
      if (!utrValue) {
        toast.error("Please upload slip or enter UTR NO");
        return;
      }
      if (utrValue?.length <= 10) {
        toast.error("UTR NO length should be more than 10 characters");
        return;
      }
      setLoading(true);
      let payload: any = {
        userId: depositItem?.userId,
        balance: editedAmount,
        updatedBy: {
          name: User.data.name,
          _id: User.data._id,
          city: address?.city,
          state: address?.state,
          lat: locationInfo?.coords?.latitude?.toString(),
          long: locationInfo?.coords?.longitude?.toString(),
        },
        reason: selectedReason,
        ...(selectedReason ==
        `manual-deposit-${depositItem?.paymentGatewayName?.replace(/\t/g, "")}`
          ? { type: "paymentGatewayManualDeposit" }
          : {}),
        remark: `Deposite failure of ${depositItem?.userName} through ${depositItem?.paymentGatewayName?.replace(/\t/g, "")} pay with order id ${depositItem?.orderId} and mobile no ${depositItem?.userMobile}`,
        tag: "credit",
        orderId: depositItem?.orderId,
        mid: selectedDialogMid || depositItem?.mid,
        paymentDate: selectdate,
        utr: utrValue,
      };

      updatePaymentGatewayName();

      let methods: any = ["upi-payment", "IMPS", "NEFT"];
      let endPoint = methods?.includes(depositItem?.paymentGatewayName)
        ? "coin/addUpi"
        : "coin/add";

      console.log("payload 871::", payload);

      axios
        .post(
          `${API_Endpoint}/${endPoint}`,
          {
            token: encryptData(payload),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
        .then((response) => {
          console.log("response:::", response);

          setOpenPopup(false);
          setDepositData((prevData) =>
            prevData.map((item) =>
              item.orderId === depositItem?.orderId
                ? { ...item, status: "Approved" }
                : item,
            ),
          );
          setLoading(false);
          toast("Amount deposited Successfully!");
          rejectDeposit(event || { preventDefault() {} });
          filterTransaction();
        })
        .catch((error) => {
          console.log("error:::", error);

          setLoading(false);
          setOpenPopup(false);
          toast(error.response.data.message);
        })
        .finally(() => {
          setUtrNo("");
          setUtrSlipName("");
        });
    } else {
      locationInfo?.requestLocation();
      getAddress();
      return;
    }
  };

  const handleSubmit = (event: any) => {
    event.preventDefault();
    submitManualSettle(undefined, event);
  };

  const handleUtrSlipUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isUtrSlipFile(file)) {
      toast.error("Please upload GPay / PhonePe / Paytm screenshot (JPG/PNG)");
      e.target.value = "";
      return;
    }

    setUtrReading(true);
    setUtrSlipName(file.name);
    try {
      const extractedUtr = await readUtrFromSlip(file);
      if (extractedUtr) {
        setUtrNo(extractedUtr);
        toast.success("UTR read from slip successfully");
        // Same submit flow as Submit button (pass UTR directly — state may not be updated yet)
        submitManualSettle(extractedUtr);
      } else {
        setUtrNo("");
        toast.error("Could not read UTR from slip. Please enter manually.");
      }
    } catch (error) {
      console.error("UTR slip read failed:", error);
      toast.error("Failed to read UTR from slip");
    } finally {
      setUtrReading(false);
      e.target.value = "";
    }
  };

  const clearDate = () => {
    setStartDate("");
    setEndDate("");
    setFetchAllData("");
    setCurrentPage(1);
  };

  const handleRejectPopup = (orderId: string) => {
    setOpenRejectPopup(true);
    setRejectId(orderId);
  };

  useEffect(() => {
    if (searchUserStatus == "All") {
      clearFilters();
    } else {
      filterTransaction();
      getFundRequests();
    }
  }, [
    currentPage,
    itemsPerPage,
    fetchAllData,
    searchUserStatus,
    searchDepositUserState,
    appClientName,
  ]);

  const handleSelect = (event: any) => {
    setSearchUserStatus(event.target.value);
    localStorage.setItem("searchUserStatus", event.target.value);
  };
  const headings = [
    [
      "Sr.",
      "_Id",
      "User Id",
      "Amount",
      "Order Id",
      "OrderKey Id",
      "Payment Method",
      "Mid",
      "User Name",
      "Status",
      "User Email",
      User.data.mobile == "8740046022" ? "" : "Mobile",
      "User City",
      "User State",
      "Payment Type",
      "latitude",
      "longitude",
      "",
      "",
      "",
      "Date",
      "Time",
    ],
  ].filter((heading: any) => heading !== "");

  // Transform the deposit data based on the user responsibility
  const transformedData = depositData.map((item) => {
    const date = new Date(item.createdOn);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();

    // Destructure 'userMobile' out and use the rest of the object
    const { userMobile, ...rest } = item;

    // Determine the final data to include 'userMobile' or not
    const finalData =
      User.data.mobile === "8740046022"
        ? rest // Include userMobile if user has the specified mobile
        : { ...item }; // Exclude userMobile otherwise

    // Return the transformed data along with formatted date and time fields
    return {
      ...finalData,
      createdDate: formattedDate,
      createdTime: formattedTime,
    };
  });

  const handleDepositSearchCity = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchDepositUserCity(event.target.value);
    localStorage.setItem("searchDepositCity", event.target.value);
  };
  const handleUserBankNameSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setUserBankName(event.target.value);
    localStorage.setItem("userBankName", event.target.value);
  };
  const handleSearchClientOrderId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchClientOrderId(event?.target.value);
  };

  const handleSearchUpiId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUpiId(event.target.value);
  };

  const handleDepositSearchState = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchDepositUserState(event.target.value);
    localStorage.setItem("searchDepositState", event.target.value);
  };

  const handleSearchAccNo = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchAccNo(event.target.value);
    localStorage.setItem("searchDepositAccNo", event.target.value);
  };
  const handleSearchAadharNo = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchAdharNo(event.target.value);
    localStorage.setItem("searchDepositAadharNo", event.target.value);
  };

  type Cities = {
    [key: string]: []; // Index signature allows any string key
  };

  // clear all filters
  const clearFilters = () => {
    localStorage.removeItem("searchUserMob");
    localStorage.removeItem("searchUserAmount");
    localStorage.removeItem("searchUserName");
    localStorage.removeItem("searchDepositCity");
    localStorage.removeItem("searchDepositState");
    localStorage.removeItem("searchDepositAccNo");
    localStorage.removeItem("searchDepositAadharNo");
    localStorage.removeItem("searchUserStatus");
    localStorage.removeItem("userBankName");
    window.location.reload();
  };

  useEffect(() => {
    const getCityStates = async () => {
      let token = localStorage.getItem("token");

      await axios
        .post(
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

  const getUniqueDepositPending = () => {
    let token = localStorage.getItem("token");
    let data = {};
    if (startDate && endDate) {
      data = {
        startDate: dateTime(startDate),
        endDate: dateTime(endDate),
      };
    } else if (fundId === "alldata") {
      data = {};
    } else {
      // const currentDate = new Date().toISOString().split('T')[0];
      const currentDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      data = {
        startDate: dateTime(currentDate),
        endDate: dateTime(currentDate),
      };
    }
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/SubAdmin/fund-request`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(data) },
    };
    // call api -----------------
    axios
      .request(config)
      .then(async (response) => {
        let payload = await decryptData(response.data.data);
        setUniquePendingDeposit(payload.payload.uniquePendingDetail);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleDepositClick = () => {
    const currentDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    let data = {
      startDate: dateTime(currentDate),
      endDate: dateTime(currentDate),
      type: "pending",
      itemsPerPage: 10,
      filter: {},
    };
    navigate("/fundreq-coin", { state: data });
  };

  useEffect(() => {
    getUniqueDepositPending();
  }, []);

  useEffect(() => {
    console.log("depositItem:", depositItem);
    if (
      depositItem?.status === "Pending" &&
      depositItem?.paymentType === "instant-deposit-manual"
    ) {
      console.log("matched");
      setSelectedReason("instant-deposit-manual");
    } else if (depositItem?.status === "Pending") {
      setSelectedReason(
        `manual-deposit-${depositItem?.paymentGatewayName?.replace(/\t/g, "")}`,
      );
    } else if (
      depositItem?.status === "Processing" &&
      selectedReason !== "deposit-uco-trpl"
    ) {
      setSelectedReason("deposit-uco-trpl");
    } else if (
      depositItem?.status === "Processing" &&
      selectedReason !== "deposit-sapt-rishi"
    ) {
      setSelectedReason("deposit-sapt-rishi");
    } else if (
      depositItem?.status === "Processing" &&
      selectedReason !== "deposit-upi-id"
    ) {
      setSelectedReason("deposit-upi-id");
    } else if (
      depositItem?.status === "Processing" &&
      selectedReason !== "deposit-manual"
    ) {
      setSelectedReason("deposit-manual");
    } else if (
      depositItem?.status === "Pending" &&
      selectedReason !== "Deposit Failure"
    ) {
      setSelectedReason("Deposit Failure");
    }
  }, [depositItem]);

  const [scannerData, setScannerData] = useState<any>([]);
  const [totalScannerAmt, setTotalScannerAmt] = useState<any>({});
  // Define the ref type as HTMLTableElement
  const tableRef = useRef<HTMLTableElement | null>(null);

  const getScannerData = () => {
    let token = localStorage.getItem("token");
    let data: any = {};
    setLoading(true);
    if (startDate && endDate) {
      data.startDate = new Date(startDate).toISOString().split("T")[0];
      data.endDate = new Date(endDate).toISOString().split("T")[0];
    } else {
      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(
        today.getMonth() + 1,
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      data.startDate = localDate;
      data.endDate = localDate;
      data.clientName = scannerAppClientName;
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

    console.log("955::", data);

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/transaction/get-scanner-data`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(data) },
    };

    axios
      .request(config)
      .then(async (response) => {
        setLoading(false);
        let data = await decryptData(response.data.data);
        setTotalScannerAmt(
          isArray(data.payload.CoinTotalDeposit) &&
            data.payload.CoinTotalDeposit[0],
        );
        const items = data.payload.coinData.items ?? [];
        const states =
          User?.data?.accessibleStates?.map((s: string) => s.toLowerCase()) ??
          [];

        setScannerData(
          states.length === 0
            ? items
            : items.filter((item: any) =>
                states.includes(item?.state?.toLowerCase()),
              ),
        );
        // setScannerData(data.payload.coinData.items);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
      });
  };

  useEffect(() => {
    getScannerData();
  }, [requestType, currentPage, scannerAppClientName]);

  // handle click on scanner total amount
  const handleScannerAmountClick = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setRequestType("scanner");
    }
  };

  const getPaymentGetways = async () => {
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
        setPaymentGatewayNames(API_RESPONSE.payload);
      })
      .catch((error) => {
        setLoading(false);
        console.log(error);
      });
  };

  const getPayInGatewayNames = async () => {
    let token = localStorage.getItem("token");
    let data: any = {};
    setLoading(true);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/payinAccounts/getPayinGatewayName`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(data) },
    };

    await axios
      .request(config)
      .then(async (response) => {
        setLoading(false);
        let API_RESPONSE = decryptData(response.data.data);
        setPayinGatewayName(API_RESPONSE?.payload);
      })
      .catch((error) => {
        setLoading(false);
        console.log(error);
      });
  };

  useEffect(() => {
    getPaymentGetways();
    getPayInGatewayNames();
  }, []);

  useEffect(() => {
    filterTransaction();
  }, [selectedGateway]);

  const paymentGatewayColors: any = {
    A2Z_CN: { color: "#c6ecc6" },
    "A2Z-CN": { color: "#c6ecc6" },
    AirPay: { color: "#df9fbf" },
    CASHFREE: { color: "#FFCCCC" },
    COSMOS: { color: "#ffb3cc" },
    DIGITECH: { color: "#ff99e6" },
    FASHIONMALL: { color: "#ffffb3" },
    FINO: { color: "#d6b0f5" },
    saptRishi: { color: "#fad16e" },
    "FRESH FIELD GRAINS": { color: "#ffffcc" },
    "FRIENDLY FARM": { color: "#d98cb3" },
    "GLOBAL IT SOLUTIONS": { color: "#fff2e6" },
    "GO AGRO": { color: "#99b3e6" },
    "GO AHEAD TOURS": { color: "#c2c2d6" },
    "GRAIN RICH": { color: "#ccffff" },
    "GRAND SPORT SHOES": { color: "#ffd9b3" },
    GW: { color: "#99b3ff" },
    Global_Travail: { color: "#ffcc99" },
    "HT SKILL GAMES PRIVATE LIMITED": { color: "#F8FAFC" },
    Htskillgame: { color: "#FFCCE1" },
    "ORGANIC AND HEALTHY FOOD": { color: "#f5f5f0" },
    "Orgainc food store": { color: "#e699cc" },
    "PREMIUM GRAINS": { color: "#ddddbb" },
    "RK games": { color: "#ffff99" },
    RK_YESBANK: { color: "#CCFFFF" },
    Rice_Plus: { color: "#cceeff" },
    "SUNRISE GRAIN STORE": { color: "#ccffb3" },
    "Third Eye": { color: "#34aeeb" },
    diggibuzz: { color: "#dd99ff" },
    friendlyfarm: { color: "#FFFFCC" },
    "gravity-grid": { color: "#01f0fc" },
    "s2-pay-ofs": { color: "#8aba98" },
    swiftpay: { color: "#ffccdd" },
    trpl: { color: "#e0ebeb" },
    ucoTrpl: { color: "#89f0ec" },
    winBig: { color: "#34aeeb " },
    WB: { color: "#34aeeb " },
    GG: { color: "#34aeeb " },
    "RK-phonePay": { color: "#5f259f91" },
    ofs: { color: "#ffe3b4" },
    NA: { color: "#B9D4AA" },
    "rms-Pay": { color: "#4f7af9ff" },
    HDFC_TRPL_IMPS: { color: "#4d7cab91" },
    organic: { color: "#46ECD5" },
    rms: { color: "#4f7af9ff" },
    "rms-new": { color: "#8175efff" },
    "HL-PAY": { color: "#f977e8ff" },
  };

  // const [coinsLimitData, setCoinLimitsData] = useState<any>({ coinLimit: 0 });
  // const refreshLimit = () => {
  //   let data = {
  //     _id: User?.data?._id,
  //   };
  //   let config = {
  //     method: "post",
  //     maxBodyLength: Infinity,
  //     url: `${API_Endpoint}/SubAdmin/get-subadmin`,
  //     headers: {
  //       Authorization: `Bearer ${User.token}`,
  //     },
  //     data: { token: encryptData(data) },
  //   };
  //   axios
  //     .request(config)
  //     .then(async (response) => {
  //       let API_Response = await decryptData(response?.data?.data);
  //       setCoinLimitsData(API_Response?.payload);
  //     })
  //     .catch((error) => {
  //       console.log(error);
  //     });
  // };

  // useEffect(() => {
  //   const id = setInterval(() => {
  //     refreshLimit();
  //   }, 3000);

  //   return () => clearInterval(id);
  // }, [refreshLimit]);

  // copty mobile
  const copyMobile = async (textToCopy: any) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${textToCopy} Coppied`);
    } catch (err) {
      console.log(err);
    }
  };

  function chunkArray(array: any[], chunkSize: number) {
    const result = [];
    for (let i = 0; i < array?.length; i += chunkSize) {
      result?.push(array.slice(i, i + chunkSize));
    }
    return result;
  }

  const getRandomNonRed = () => {
    let h = Math.floor(Math.random() * 360);

    // avoid hue near 0° or 360° (red zone)
    while (h < 20 || h > 340) {
      h = Math.floor(Math.random() * 360);
    }

    const s = 70; // saturation
    const l = 50; // lightness
    console.log("`hsl(${h}, ${s}%, ${l}%)`::", `hsl(${h}, ${s}%, ${l}%)`);

    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  const openWhatsApp = (res: any) => {
    if (!res?.userMobile) return;

    let formatted = res.userMobile.toString().replace(/\D/g, "");
    if (formatted.length === 10) formatted = "91" + formatted;

    const stateWiseMsg =
      res.userState === "Karnataka"
        ? `Hello {USER_NAME} Sir,\nWelcome to ${res?.clientName} Games.\nನೀವು ಠೇವಣಿ ಮಾಡಲು ಪ್ರಯತ್ನಿಸುತ್ತಿರುವಿರಿ ಎಂದು ಕಾಣುತ್ತದೆ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`
        : ["Telangana", "Andhra Pradesh"].includes(res.userState)
          ? `Hello {USER_NAME} Sir,\nWelcome to ${res?.clientName} Games.\nమీరు డిపాజిట్ చేయడానికి ప్రయత్నిస్తున్నారని నేను చూస్తున్నాను. నేను ఈ రోజు మీకు ఎలా సహాయం చేయగలను?`
          : ["Tamil Nadu", "Tiruchirappalli"].includes(res.userState)
            ? `Hello {USER_NAME} Sir,\nWelcome to ${res?.clientName} Games.\nநீங்கள் டெப்பாசிட் செய்ய முயற்சிக்கிறீர்கள் என்று பார்க்கிறேன். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?`
            : `Hello {USER_NAME} Sir,\nWelcome to ${res?.clientName} Games.\nI see you're trying to make a deposit. How can I assist you today?`;

    const message = stateWiseMsg.replace(
      "{USER_NAME}",
      res.userName?.split(" ")[0] || "",
    );

    const encodedMessage = encodeURIComponent(message);
    const appUrl = `whatsapp://send?phone=${formatted}&text=${encodedMessage}`;
    const webUrl = `https://wa.me/${formatted}?text=${encodedMessage}`;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      const now = Date.now();

      // Try to open the app
      window.location.href = appUrl;

      // // After 2s, if user didn’t switch apps, assume app not installed
      // setTimeout(() => {
      //   const timeDiff = Date.now() - now;
      //   // If <1500ms passed, user likely switched apps (WhatsApp opened)
      //   // If still here after >1500ms, open fallback
      //   if (timeDiff < 1500) return;
      //   window.location.href = webUrl;
      // }, 2000);
    } else {
      window.open(webUrl, "_blank");
    }
  };

  const openTelegram = (res: any) => {
    if (!res?.userMobile) return;
    let formatted = res.userMobile.toString().replace(/\D/g, "");
    if (formatted.length === 10) formatted = "91" + formatted;

    // Try app, then web fallback
    const appUrl = `tg://resolve?phone=${formatted}`;
    const webUrl = `https://t.me/+${formatted}`;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = appUrl;
      setTimeout(() => (window.location.href = webUrl), 800);
    } else {
      window.open(webUrl, "_blank");
    }
  };

  const openUpdatePopup = (id: string, type: string) => {
    setShowUpdateFieldPopup(true);
    setId(id);
    setUpdateType(type);
  };

  const handleUpdateText = (event: ChangeEvent<HTMLInputElement>) => {
    setUpdateTextVal(event.target.value);
    setUpdateTextError(false);
  };

  const isOrderSelected = (orderId: string) =>
    selectedOrders.some((order) => order.orderId === orderId);

  const handleOrderSelect = (
    orderId: string,
    paymentGatewayName: string,
    checked: boolean,
  ) => {
    setSelectedOrders((prev) => {
      if (checked) {
        if (prev.some((order) => order.orderId === orderId)) {
          return prev;
        }
        return [...prev, { orderId, paymentGatewayName }];
      }
      return prev.filter((order) => order.orderId !== orderId);
    });
  };

  const handleUpdateMidNameClick = () => {
    if (selectedOrders.length === 0) {
      toast.error("Please select at least one deposit");
      return;
    }
    setUpdateMidModalOpen(true);
  };

  const handleUpdateMidSuccess = () => {
    setSelectedOrders([]);
    filterTransaction();
  };

  const updateGateWayDetails = () => {
    setLoading(true);
    setShowUpdateFieldPopup(false);
    const token = localStorage.getItem("token");
    let data: any = {
      _id: id,
    };
    data.mid = updateTextVal;

    axios
      .post(
        `${API_Endpoint}/transaction/updateMid`,
        { token: encryptData(data) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      .then(async (response) => {
        if (response?.data?.success) {
          filterTransaction();
        }
        setUpdateTextVal("");
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        setUpdateTextVal("");
        toast.error(error.response.data.message);
      });
  };

  const downloadExcel = (): void => {
    // Determine dataset based on current request type
    const dataType =
      requestType === "scanner"
        ? "Scanner"
        : requestType === "instantDeposit"
          ? "InstantDeposit"
          : "Deposit";

    const combinedData =
      requestType === "scanner"
        ? scannerData
        : requestType === "instantDeposit"
          ? depositData.filter(
              (subData: any) => subData?.instantDeposit === true,
            )
          : depositData;

    if (!combinedData || combinedData.length === 0) {
      toast("No data to export!");
      return;
    }

    // // 1️⃣ Collect all unique keys from both deposit and scanner data
    // const depositKeys: string[] =
    //   depositData.length > 0 ? Object.keys(depositData[0]) : [];
    // const scannerKeys: string[] =
    //   scannerData.length > 0 ? Object.keys(scannerData[0]) : [];
    // const allKeys = Array.from(new Set([...depositKeys, ...scannerKeys]));

    // // 2️⃣ Normalize overlapping keys (merge city/state + amount/balance)
    // const normalizedKeys = allKeys.map((key: string) => {
    //   if (key === "state") return "userState";
    //   if (key === "city") return "userCity";
    //   if (key === "balance") return "amount"; // merge balance into amount
    //   return key;
    // });

    // const uniqueKeys = Array.from(new Set(normalizedKeys));

    // // 3️⃣ Merge & normalize all records
    // const mergedData: Record<string, any>[] = combinedData.map(
    //   (item: Record<string, any>) => {
    //     const normalized: Record<string, any> = {};

    //     uniqueKeys.forEach((key: string) => {
    //       if (key === "userState")
    //         normalized[key] = item["userState"] || item["state"] || "";
    //       else if (key === "userCity")
    //         normalized[key] = item["userCity"] || item["city"] || "";
    //       else if (key === "amount")
    //         normalized[key] = item["amount"] ?? item["balance"] ?? 0;
    //       else normalized[key] = item[key] ?? "";
    //     });

    //     normalized["source"] = dataType;
    //     return normalized;
    //   }

    // 1️⃣ Collect all unique keys from both deposit and scanner data
    const depositKeys: string[] =
      depositData.length > 0 ? Object.keys(depositData[0]) : [];
    const scannerKeys: string[] =
      scannerData.length > 0 ? Object.keys(scannerData[0]) : [];
    const allKeys = Array.from(new Set([...depositKeys, ...scannerKeys]));

    // 2️⃣ Normalize overlapping keys like state/userState, city/userCity
    const normalizedKeys = allKeys.map((key: string) => {
      if (key === "state") return "userState";
      if (key === "city") return "userCity";
      return key;
    });

    const uniqueKeys = Array.from(new Set(normalizedKeys));

    // 3️⃣ Merge & normalize all records
    const mergedData: Record<string, any>[] = combinedData.map(
      (item: Record<string, any>) => {
        const normalized: Record<string, any> = {};
        uniqueKeys.forEach((key: string) => {
          if (key === "userState")
            normalized[key] = item["userState"] || item["state"] || "";
          else if (key === "userCity")
            normalized[key] = item["userCity"] || item["city"] || "";
          else normalized[key] = item[key] ?? 0;
        });
        normalized["source"] = dataType;
        return normalized;
      },
    );

    // 4️⃣ Create Excel sheet
    const worksheet = XLSX.utils.json_to_sheet(mergedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${dataType}_Data`);

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // 🗂 File name includes type and timestamp
    const fileName = `${dataType}_Data_${
      new Date().toISOString().split("T")[0]
    }_${Date.now()}.xlsx`;

    saveAs(blob, fileName);
  };

  const checkGoPayStatus = async (e: any, orderId: string) => {
    let token = localStorage.getItem("token");
    await axios
      .post(
        `https://organicfoodsstore.online/api/gopay/payinStatus`,
        { order_id: orderId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            maxBodyLength: Infinity,
          },
        },
      )
      .then(async (response) => {
        if (response?.data?.statusMessage === "SUCCESS") {
          handleSubmit(e);
        }
        console.log("statusMessag::::", response);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const approvePendingPayment = async (e: any, orderId: string) => {
    let token = localStorage.getItem("token");
    await axios
      .post(
        `${API_Endpoint}/transaction/approve-pending-by-orderId`,
        { orderId: orderId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            maxBodyLength: Infinity,
          },
        },
      )
      .then(async (response) => {
        filterTransaction();
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const checkedBy = (itemId: string, check: string, status: boolean) => {
    if (
      locationInfo?.coords?.latitude &&
      locationInfo?.coords?.longitude &&
      address?.state &&
      address?.city
    ) {
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
        url: `${API_Endpoint}/transaction/check-deposit`,
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
            if (response?.data?.success) {
              filterTransaction();
            }
          }
        })
        .catch((error) => {
          console.log(error);
        });
    } else {
      toast.error("Location Information Missing");
      locationInfo?.requestLocation();
      getAddress();
    }
  };

  const isWithin3Days = (date: any) => {
    if (!date) return false;
    const requestDate = new Date(date);
    const today = new Date();
    const diffTime = today.getTime() - requestDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= 3;
  };

  const canEditDeposit = (user: any, item: any) => {
    if (
      !user?.data?.Responsibilities?.includes(Responsibilities?.Deposit_Pensil)
    ) {
      return false;
    }
    const isOld = !isWithin3Days(item?.createdOn);
    const isChecked = !!(item?.checkBy && item?.crossCheckBy);
    const isHighAmount = item?.amount >= 10000;
    if (isOld) return isChecked;
    if (!isHighAmount) return true;
    return isChecked;
  };

  return (
    <>
      {createPortal(
        <ToastContainer
          autoClose={2000}
          position="top-center"
          style={{ zIndex: 10000 }}
        />,
        document.body,
      )}
      {loading ? (
        <Loader />
      ) : (
        <div className="g-sidenav-show  bg-gray-100">
          <Sidenav />
          <main className="main-content position-relative">
            <div style={{ background: "#f8f9fa" }}>
              <Breadcrumbs tab={"Deposit"} />
              {/* <div className="container-fluid">
                <div className="row">
                  <DepositWithdrawCard title={`Deposit Approved Amt (${depositCardData?.depositeApprovedData?.count ? depositCardData?.depositeApprovedData?.count : 0}) : ${depositCardData?.depositeApprovedData?.totalAmount ? depositCardData?.depositeApprovedData?.totalAmount : 0}`} title2={`Deposit Pending Amt (${depositCardData?.depositePendingData?.count ? depositCardData?.depositePendingData?.count : 0}) : ${depositCardData?.depositePendingData?.totalAmount ? depositCardData?.depositePendingData?.totalAmount : 0}`} />
                  <DepositWithdrawCard title={`Withdrawal Approved Amt (${depositCardData?.totalApprovedWithdrawalData?.count ? depositCardData?.totalApprovedWithdrawalData?.count : 0}) : ${depositCardData?.totalApprovedWithdrawalData?.totalAmount ? depositCardData?.totalApprovedWithdrawalData?.totalAmount : 0}`} title2={`Withdrawal Pending Amt (${depositCardData?.totalPendingWithdrawalData?.count ? depositCardData?.totalPendingWithdrawalData?.count : 0}) : ${depositCardData?.totalPendingWithdrawalData?.totalAmount ? depositCardData?.totalPendingWithdrawalData?.totalAmount : 0}`} title3={`Withdrawal Reverse Amt (${depositCardData?.totalReverseWithdrawalData?.count ? depositCardData?.totalReverseWithdrawalData?.count : 0}) : ${depositCardData?.totalReverseWithdrawalData?.totalAmount ? depositCardData?.totalReverseWithdrawalData?.totalAmount : 0}`} title4={`Withdrawal Rejected Amt : (${depositCardData?.totalWithdrawalRejected?.count ? depositCardData?.totalWithdrawalRejected?.count : 0}) : ${depositCardData?.totalWithdrawalRejected?.totalAmount ? depositCardData?.totalWithdrawalRejected?.totalAmount : 0}`} title5={`Withdrawal on Hold Amt : (${depositCardData?.totalOnholdWithdrawalData?.count ? depositCardData?.totalOnholdWithdrawalData?.count : 0}) : ${depositCardData?.totalOnholdWithdrawalData?.totalAmount ? depositCardData?.totalOnholdWithdrawalData?.totalAmount : 0}`} />
                </div>
              </div> */}
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
                            "5000",
                            "10000",
                            "20000",
                          ]}
                          className="deposit-select"
                        />
                      </div>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a
                        onClick={
                          requestType === "scanner"
                            ? getScannerData
                            : filterTransactionData
                        }
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
                    <div
                      className="col-6 col-xl-2 col-sm-4 pdrt "
                      style={{ cursor: "pointer" }}
                    >
                      <label className="lbl"></label>
                      <a onClick={clearFilters} className="sechBtn mt-1">
                        Clear All Filters
                      </a>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt  align-items-center mt-3">
                      <label className="lbl"></label>
                      <b>Total User : {totalUser}</b>
                    </div>
                    {User.data.Role_ID === "64f710d9a2ab78980020c5fb" && (
                      <div className="col-6 col-xl-2 col-sm-4 pdrt  align-items-center mt-3">
                        <label className="lbl"></label>
                        <b>
                          Approved{" "}
                          {`(${
                            totalAmount?.depositData?.depositApprovedCount || 0
                          }) : ${
                            totalAmount?.depositData?.depositApprovedTotal || 0
                          }`}
                        </b>
                      </div>
                    )}

                    {User.data.Role_ID === "658a877056138bb0bc4eba35" && (
                      <div className="col-6 col-xl-2 col-sm-4 pdrt  align-items-center mt-3">
                        <label className="lbl"></label>
                        <b onClick={handleDepositClick}>
                          {" "}
                          Pending Deposit{" "}
                          {`(${totalDepositData?.depositPendingCount ?? 0}) : ${
                            totalDepositData?.depositPendingTotal ?? 0
                          }`}
                        </b>
                      </div>
                    )}
                    <div className="col-6 col-xl-2 col-sm-4 pdrt  align-items-center mt-3">
                      <label className="lbl"></label>
                      <b onClick={handleDepositClick}>
                        Unique Pending Deposit{" "}
                        {`(${uniquePendingDeposit?.pendingCount ?? 0}) : ${
                          uniquePendingDeposit?.pendingAmount ?? 0
                        }`}
                      </b>
                    </div>
                    <div className="col-6 col-xl-2 col-sm-4 pdrt  align-items-center mt-3">
                      <label className="lbl"></label>
                      <b>
                        Rejected{" "}
                        {`(${
                          totalDepositData?.depositRejectedCount
                            ? totalDepositData?.depositRejectedCount
                            : 0
                        }) : ${
                          totalDepositData?.depositRejectedTotal
                            ? totalDepositData?.depositRejectedTotal
                            : 0
                        }`}
                      </b>
                    </div>
                    <div
                      style={{ cursor: "pointer" }}
                      onClick={handleScannerAmountClick}
                      className="col-12 col-xl-2 col-sm-4 pdrt  align-items-center mt-3"
                    >
                      <label className="lbl"></label>
                      <b>
                        Total Scanner Amount :{" "}
                        <span style={{ color: "#000" }}>
                          {totalScannerAmt?.totalAmount ?? 0}{" "}
                        </span>
                      </b>
                    </div>
                    {((User.data.Responsibilities.includes(
                      Responsibilities.Excel,
                    ) &&
                      User.data.Role_ID === "64f710d9a2ab78980020c5fb") ||
                      User.data.mobile === "8740046022") && (
                      <div className="col-4 col-xl-2 col-sm-4 pdrt  align-items-center mt-3">
                        {/* <div className="excel_sheet exdd">
                            <ExcelExport
                              inputData={transformedData}
                              headings={headings}
                              fileName={"Deposit_Data"}
                            />
                            <span className="ex_dow_name">Download Data</span>
                          </div> */}
                      </div>
                    )}
                    {User.data.Responsibilities.includes(
                      Responsibilities?.State_Wise_Deposit,
                    ) && (
                      <>
                        <div className="col-6 col-xl-2 col-sm-3 pdrt">
                          <label className="lbl"></label>
                          <Link
                            to={"/unique_deposit_pending"}
                            className="sechBtn mt-1"
                          >
                            Unique pending Deposit
                          </Link>
                        </div>

                        {User.data.Responsibilities.includes(
                          Responsibilities?.State_Wise_Deposit,
                        ) && (
                          <div className="col-6 col-xl-2 col-sm-3 pdrt">
                            <label className="lbl"></label>
                            <Link
                              to={"/state-wise-deposit"}
                              className="sechBtn mt-1"
                            >
                              State wise Deposit
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                    {/* {User.data.Responsibilities.includes(
                      Responsibilities?.show_download_botton
                    ) && ( */}
                    <div
                      className="col-6 col-xl-2 col-sm-4 pdrt "
                      style={{ cursor: "pointer" }}
                    >
                      <label className="lbl"></label>
                      <a
                        onClick={() => setDownloadModalShown(true)}
                        className="sechBtn mt-1"
                      >
                        Download Data
                      </a>
                    </div>
                    {canUpdateDepositMid && (
                      <div
                        className="col-6 col-xl-2 col-sm-4 pdrt"
                        style={{ cursor: "pointer" }}
                      >
                        <label className="lbl"></label>
                        <a
                          onClick={handleUpdateMidNameClick}
                          className="sechBtn mt-1"
                        >
                          Update mid name
                        </a>
                      </div>
                    )}
                    {/* )} */}

                    <div className="data-action_">
                      {/* <div className="coin-limit-text_">
                        <b>Coins Limit : </b>
                        {coinsLimitData?.coinLimit}
                      </div> */}
                      {/* <button
                        onClick={refreshLimit}
                        className="data-action-button_ mt-2"
                      >
                        Refresh Limit <Refresh />
                      </button> */}
                    </div>
                  </div>
                  <div className="col-12 mt-1" ref={tableRef}>
                    <div className="table-responsive">
                      {requestType == "automatic" && (
                        <table className="table table-view">
                          <thead>
                            <tr>
                              <th>
                                Sr
                                <br />
                                No
                              </th>
                              <th>
                                User <br /> Name
                              </th>
                              <th>
                                Payment <br /> Method
                              </th>
                              {User?.data?.Responsibilities?.includes(
                                Responsibilities.contact_visibility_none,
                              ) === false && (
                                <th>
                                  Mobile <br /> No
                                </th>
                              )}
                              {/* {User?.data?.Responsibilities?.includes(
                                Responsibilities.contact_visibility_none
                              ) === false && <th></th>} */}
                              <th>
                                App <br /> Name
                              </th>
                              <th>Amount</th>
                              <th>
                                Txn
                                <br />
                                Details
                              </th>
                              <th>
                                Last
                                <br />
                                Activity
                              </th>
                              <th>
                                Check
                                <br />
                                By
                              </th>
                              <th>
                                Cross Checked
                                <br />
                                By
                              </th>
                              <th>
                                User <br /> State
                              </th>
                              <th>
                                User <br /> City
                              </th>
                              <th>
                                User Bank <br /> Name
                              </th>
                              <th>Secondary User Name</th>
                              <th>
                                Account <br /> Number
                              </th>
                              <th>IFSC</th>
                              <th>
                                Aadhar <br /> Number
                              </th>
                              {/* <th>UTR</th> */}
                              <th>
                                Transaction <br /> Id
                              </th>
                              <th>Client Txnid</th>
                              <th>DP Id</th>
                              {/* <th>Date</th>
                              <th>Time</th>
                              <th>Status</th> */}
                              <th>
                                Payment <br /> Type
                              </th>
                              {/* <th>Status</th> */}
                              <th>Kyc</th>
                              <th>
                                Rejected <br /> Reason
                              </th>
                              <th>UPI ID</th>
                              <th>User UPI ID</th>
                              <th>Update By Name</th>
                              {/* <th>Update By Time</th> */}
                            </tr>
                          </thead>
                          <thead>
                            <tr className="bg-table">
                              <th className="thdr">
                                <FormControl>
                                  <InputLabel
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "bold",
                                      marginTop: "3px",
                                    }}
                                    id="demo-simple-select-label"
                                  >
                                    Select Payment Type
                                  </InputLabel>
                                  <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    value={requestType}
                                    label="Status"
                                    onChange={(e: any) =>
                                      setRequestType(e.target.value)
                                    }
                                  >
                                    <MenuItem value={"automatic"}>
                                      Autm
                                    </MenuItem>
                                    <MenuItem value={"scanner"}>
                                      Scanner
                                    </MenuItem>
                                    <MenuItem value={"instantDeposit"}>
                                      IT Des
                                    </MenuItem>
                                  </Select>
                                </FormControl>
                              </th>
                              {/* <th></th> */}
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchUserName}
                                    onChange={handleSearchUserName}
                                    onSearch={filterTransaction}
                                    placeholder="Search by user name"
                                  />
                                </div>
                              </th>

                              {/* <th className="thdr"> */}
                              {/* <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchUserName}
                                    onChange={handleSearchDpId}
                                    onSearch={searchDpId}
                                    placeholder="Search by user Dp ID"
                                  />
                                </div> */}
                              {/* </th> */}
                              <th className="thdr">
                                <Select
                                  labelId="demo-simple-select-label"
                                  id="demo-simple-select"
                                  value={selectedGateway?.mid}
                                  label="Status"
                                  onChange={(e) => {
                                    const selectedGateway =
                                      paymentGetwayNames.find(
                                        (gateway: any) =>
                                          gateway?.mid === e.target.value,
                                      );
                                    setSelectedGateWay(selectedGateway || null);
                                  }}
                                >
                                  {paymentGetwayNames?.length > 0 &&
                                    paymentGetwayNames.map(
                                      (gateWay: any, index: number) => (
                                        <MenuItem
                                          key={`gateWay._${index}`}
                                          value={gateWay.mid}
                                        >
                                          {/* {gateWay.name}
                                          {"-"}
                                          {gateWay.mid} */}
                                          {gateWay?.mid}
                                        </MenuItem>
                                      ),
                                    )}
                                </Select>
                              </th>
                              {User?.data?.Responsibilities?.includes(
                                Responsibilities.contact_visibility_none,
                              ) === false && (
                                <th className="thdr">
                                  <div className=" justify-content-center">
                                    <SearchBar
                                      value={searchUserMobile}
                                      onChange={handleSearchUserMob}
                                      onSearch={filterTransaction}
                                      placeholder="Search by mobile no"
                                    />
                                  </div>
                                </th>
                              )}
                              {/* <th className="thdr"></th> */}
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
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchUserAmount}
                                    onChange={handleSearchUserAmount}
                                    onSearch={filterTransaction}
                                    placeholder="Search by amount"
                                  />
                                </div>
                              </th>
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <Select
                                    labelId="demo-select-small-label"
                                    id="demo-select-small"
                                    value={searchUserStatus}
                                    label="Select status"
                                    onChange={(e: any) => handleSelect(e)}
                                  >
                                    <MenuItem value={"All"}>All</MenuItem>
                                    <MenuItem value={"Pending"}>
                                      Pending
                                    </MenuItem>
                                    <MenuItem value={"Approved"}>
                                      Approved
                                    </MenuItem>
                                    <MenuItem value={"Rejected"}>
                                      Rejected
                                    </MenuItem>
                                    <MenuItem value={"Reverse"}>
                                      Reverse
                                    </MenuItem>
                                    <MenuItem value={"on hold"}>
                                      on hold
                                    </MenuItem>
                                    <MenuItem value={"Processing"}>
                                      Processing
                                    </MenuItem>
                                  </Select>
                                </div>
                              </th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <Select
                                    labelId="demo-select-small-label"
                                    id="demo-select-small"
                                    label="Select state Name"
                                    value={searchDepositUserState}
                                    onChange={(e: any) =>
                                      handleDepositSearchState(e)
                                    }
                                  >
                                    {depositStates?.map((state) => {
                                      return (
                                        <MenuItem value={state}>
                                          {state}
                                        </MenuItem>
                                      );
                                    })}
                                  </Select>
                                </div>
                              </th>
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchDepositUserCity}
                                    onChange={handleDepositSearchCity}
                                    onSearch={filterTransaction}
                                    placeholder="Search by user city"
                                  />
                                </div>
                              </th>
                              <th className="thdr">
                                {/*  code new*/}
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={userBankName}
                                    onChange={handleUserBankNameSearch}
                                    onSearch={filterTransaction}
                                    placeholder="Search by user Bank Name"
                                  />
                                </div>
                              </th>
                              <th className="thdr">
                                {/*  code new*/}
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={userBankName}
                                    onChange={handleUserBankNameSearch}
                                    onSearch={filterTransaction}
                                    placeholder="Search by user Name"
                                  />
                                </div>
                              </th>
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchAccNo}
                                    onChange={handleSearchAccNo}
                                    onSearch={filterTransaction}
                                    placeholder="Search by acc no"
                                  />
                                </div>
                              </th>
                              <th className="thdr"></th>
                              <th className="thdr">
                                <div className="justify-content-center">
                                  <SearchBar
                                    value={searchAadharNo}
                                    onChange={handleSearchAadharNo}
                                    onSearch={filterTransaction}
                                    placeholder="Search by aadhar no"
                                  />
                                </div>
                              </th>
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchUserOrderId}
                                    onChange={handleSearchUserOrderId}
                                    onSearch={filterTransaction}
                                    placeholder="Search by transaction id"
                                  />
                                </div>
                              </th>
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchClientOrderId}
                                    onChange={handleSearchClientOrderId}
                                    onSearch={filterTransaction}
                                    placeholder="Search by Client id"
                                  />
                                </div>
                              </th>
                              {/* <th className="thdr">
                                <Select
                                  labelId="demo-simple-select-label"
                                  id="demo-simple-select"
                                  value={selectedGateway?.mid}
                                  label="Status"
                                  onChange={(e) => {
                                    const selectedGateway =
                                      paymentGetwayNames.find(
                                        (gateway: any) =>
                                          gateway?.mid === e.target.value
                                      );
                                    setSelectedGateWay(selectedGateway || null);
                                  }}
                                >
                                  {paymentGetwayNames?.length > 0 &&
                                    paymentGetwayNames.map(
                                      (gateWay: any, index: number) => (
                                        <MenuItem
                                          key={`gateWay._${index}`}
                                          value={gateWay.mid}
                                        >
                                         
                                          {gateWay?.mid}
                                        </MenuItem>
                                      )
                                    )}
                                </Select>
                              </th> */}
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchUserId}
                                    onChange={(e: any) =>
                                      setSearchUserId(e?.target?.value)
                                    }
                                    onSearch={filterTransaction}
                                    placeholder="Search by DP id"
                                  />
                                </div>
                              </th>
                              {/* <th className="thdr"></th>
                              <th className="thdr"></th> */}

                              {/* <th className="thdr">
                                <div className=" justify-content-center withdraw-select">
                                  <Select
                                    labelId="demo-select-small-label"
                                    id="demo-select-small"
                                    value={searchUserStatus}
                                    label="Select status"
                                    onChange={(e: any) => handleSelect(e)}
                                  >
                                    <MenuItem value={"All"}>All</MenuItem>
                                    <MenuItem value={"Pending"}>
                                      Pending
                                    </MenuItem>
                                    <MenuItem value={"Approved"}>
                                      Approved
                                    </MenuItem>
                                    <MenuItem value={"Rejected"}>
                                      Rejected
                                    </MenuItem>
                                    <MenuItem value={"Reverse"}>
                                      Reverse
                                    </MenuItem>
                                    <MenuItem value={"on hold"}>
                                      on hold
                                    </MenuItem>
                                    <MenuItem value={"Processing"}>
                                      Processing
                                    </MenuItem>
                                  </Select>
                                </div>
                              </th> */}
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr">
                                <div className=" justify-content-center">
                                  <SearchBar
                                    value={searchUpiId}
                                    onChange={handleSearchUpiId}
                                    onSearch={filterTransaction}
                                    placeholder="Search by UPI ID"
                                  />
                                </div>
                              </th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              {/* <th className="thdr"></th> */}
                              {/* <th className="thdr"></th> */}
                            </tr>
                          </thead>
                          <tbody>
                            {depositData?.map((item, index) => {
                              // if (item?.status === "Failed") {
                              //   return null;
                              // }

                              return (
                                !(
                                  User?.data?.Role_ID ===
                                    "6572e1e4327edd475a3c997f" &&
                                  item.status === "Approved"
                                ) && (
                                  <tr
                                    style={{
                                      backgroundColor:
                                        // (item.status === "Approved" ||
                                        //   item.status === "approved-clr") &&
                                        // paymentGatewayColors[item?.mid]
                                        //   ? paymentGatewayColors[item?.mid]
                                        //       ?.color
                                        //   : item?.paymentGatewayName ==
                                        //       "upi-payment" &&
                                        //     (item.status == "Approved" ||
                                        //       item.status == "approved-clr")
                                        //   ? "#A7C7E7"
                                        //   : (item.status == "Approved" ||
                                        //       item.status == "approved-clr") &&
                                        //     !paymentGatewayColors[item?.mid]
                                        //   ? "#B9D4AA"
                                        //   : "transparent",
                                        item?.status === "Pending"
                                          ? "transparent"
                                          : item.status === "Approved" ||
                                              item.status === "approved-clr" ||
                                              item?.status === "SUCCESS"
                                            ? "#B9D4AA"
                                            : "#A7C7E7",
                                    }}
                                    id={item._id}
                                  >
                                    <td
                                      style={{
                                        maxWidth: 100,
                                        textAlign: "center",
                                        position: "relative",
                                      }}
                                    >
                                      <span>
                                        {index +
                                          1 +
                                          (currentPage && itemsPerPage
                                            ? (currentPage - 1) * itemsPerPage
                                            : 0)}
                                      </span>
                                      {canUpdateDepositMid &&
                                        item.status === "Approved" && (
                                          <Checkbox
                                            size="small"
                                            checked={isOrderSelected(
                                              item.orderId,
                                            )}
                                            onChange={(e) =>
                                              handleOrderSelect(
                                                item.orderId,
                                                item.paymentGatewayName,
                                                e.target.checked,
                                              )
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            sx={{
                                              position: "absolute",
                                              right: 0,
                                              top: "50%",
                                              transform: "translateY(-50%)",
                                              padding: "4px",
                                            }}
                                          />
                                        )}
                                    </td>
                                    <td
                                      onClick={() => {
                                        if (
                                          User?.data?.Responsibilities?.includes(
                                            Responsibilities.wallet_history,
                                          )
                                        ) {
                                          const url = `/user-report/${item.userId}/${item.userName}`;
                                          window.open(url, "_self");
                                        }
                                      }}
                                      style={{
                                        cursor: "pointer",
                                        maxWidth: 250,
                                        wordBreak: "break-word", // long words ko wrap karega
                                        whiteSpace: "normal", // normal wrapping
                                      }}
                                    >
                                      {item.userName}
                                    </td>

                                    {/* <td>
                                      <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                          <span>{` Gateway:- ${item.paymentGatewayName}`}</span>
                                          <span>{`Mid:- ${item.mid}`}</span>
                                        </div>
                                        {[
                                          "whatsApp-payment",
                                          "telegram-payment",
                                        ]?.includes(
                                          item.paymentGatewayName
                                        ) && (
                                          <FontAwesomeIcon
                                            id={item._id}
                                            className="fa fa-pencil-square icon-home icon-trash"
                                            icon={faPencilSquare}
                                            onClick={() =>
                                              openUpdatePopup(
                                                item._id,
                                                "displayName"
                                              )
                                            }
                                            style={{
                                              cursor: "pointer",
                                              color: "black",
                                            }}
                                          />
                                        )}
                                      </div>
                                    </td> */}
                                    <td
                                      style={{
                                        border: "none",
                                        borderWidth: 0,
                                        backgroundColor: "transparent",
                                        maxWidth: 500,
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                          justifyContent: "center",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span>{`${item.paymentGatewayName}`}</span>
                                        <span>{`${item.mid}`}</span>
                                      </div>

                                      {/* Pencil Icon Column */}

                                      <FontAwesomeIcon
                                        id={item._id}
                                        icon={faPencilSquare}
                                        onClick={() =>
                                          openUpdatePopup(
                                            item._id,
                                            "displayName",
                                          )
                                        }
                                        style={{
                                          cursor: "pointer",
                                          color: "black",
                                        }}
                                      />
                                    </td>

                                    {/* <td>{item?.userId}</td> */}
                                    {User?.data?.Responsibilities?.includes(
                                      Responsibilities.contact_visibility_none,
                                    ) === false && (
                                      <td>
                                        {User?.data?.Responsibilities?.includes(
                                          Responsibilities?.show_mobile,
                                        ) ? (
                                          <>
                                            {`${item?.userMobile}`}
                                            <ContentCopyIcon
                                              onClick={() =>
                                                copyMobile(item?.userMobile)
                                              }
                                              style={{
                                                color: "#333",
                                                fontSize: "17px",
                                                marginLeft: "10px",
                                                cursor: "pointer",
                                              }}
                                            />
                                            {item?.status === "Pending" ? (
                                              <div
                                                style={{
                                                  display: "flex", // flex container banaya
                                                  justifyContent: "center", // horizontally center
                                                  alignItems: "center", // vertically center
                                                  marginTop: "5px", // thoda gap upper content se
                                                  cursor: "pointer",
                                                }}
                                              >
                                                <div
                                                  onClick={() =>
                                                    openWhatsApp(item)
                                                  }
                                                >
                                                  <img
                                                    src="https://img.icons8.com/?size=1200&id=16713&format=jpg"
                                                    alt="Icon8 Image"
                                                    width={40}
                                                  />
                                                </div>
                                                <div
                                                  onClick={() =>
                                                    openTelegram(item)
                                                  }
                                                >
                                                  <img
                                                    src="https://i1.wp.com/sethisfy.com/wp-content/uploads/2020/10/Telegram_software-Logo.wine_.png"
                                                    alt="Icon8 Image"
                                                    width={70}
                                                  />
                                                </div>
                                              </div>
                                            ) : (
                                              "-"
                                            )}
                                          </>
                                        ) : (
                                          "**********"
                                        )}
                                      </td>
                                    )}
                                    {/* <td>
                                      {item?.status === "Pending" ? (
                                        <div onClick={() => openWhatsApp(item)}>
                                          <img
                                            src="https://img.icons8.com/?size=1200&id=16713&format=jpg"
                                            alt="Icon8 Image"
                                            width={40}
                                          />
                                        </div>
                                      ) : (
                                        "-"
                                      )}
                                    </td> */}
                                    <td>{item?.clientName}</td>
                                    <td>{item.amount}</td>
                                    <td>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                          justifyContent: "center",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span>
                                          {formattedDate(item.createdOn)}
                                        </span>
                                        <span>
                                          {formatedTime(item.createdOn)}
                                        </span>
                                        <span>{item.status}</span>
                                        {(item.status.toLowerCase() ===
                                          "pending" ||
                                          item.status.toLowerCase() ===
                                            "processing") && (
                                          <>
                                            {canEditDeposit(User, item) && (
                                              <FontAwesomeIcon
                                                className="fa fa-pencil-square icon-home icon-banner"
                                                icon={faPencilSquare}
                                                style={{ cursor: "pointer" }}
                                                onClick={() =>
                                                  openEditDialog(item)
                                                }
                                              />
                                            )}
                                          </>
                                        )}
                                        {item?.paymentGatewayName ===
                                          "Go-Pay" && (
                                          <Button
                                            onClick={(e) =>
                                              checkGoPayStatus(e, item.orderId)
                                            }
                                            variant="contained"
                                            className="btn-withdraw"
                                            style={{ marginTop: 10 }}
                                          >
                                            Check Status
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                          justifyContent: "center",
                                          alignItems: "center",
                                        }}
                                      >
                                        {!item?.lastActivity ? (
                                          <span> {"-"}</span>
                                        ) : (
                                          <>
                                            <span>
                                              {formattedDate(
                                                item?.lastActivity,
                                              )}
                                            </span>
                                            <span>
                                              {formatedTime(item?.lastActivity)}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      {(User.data.Responsibilities?.includes(
                                        Responsibilities?.Deposit_Pensil,
                                      ) &&
                                        item?.amount >= 10000) ||
                                      (!isWithin3Days(item?.createdOn) &&
                                        item?.status !== "Approved") ? (
                                        item?.checkBy ? (
                                          <div className="d-flex flex-column">
                                            <span>{item?.checkBy?.name}</span>
                                            <span>{item?.checkBy?.city}</span>
                                            <span>{item?.checkBy?.state}</span>
                                            <span>{`${formattedDate(item?.checkBy?.date)} ${formatedTime(item?.checkBy?.date)}`}</span>
                                          </div>
                                        ) : (
                                          <>
                                            <span
                                              onClick={() =>
                                                checkedBy(
                                                  item.orderId,
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
                                          </>
                                        )
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                    <td>
                                      {(User.data.Responsibilities?.includes(
                                        Responsibilities?.Deposit_Pensil,
                                      ) &&
                                        item?.amount >= 10000) ||
                                      (!isWithin3Days(item?.createdOn) &&
                                        item?.status !== "Approved") ? (
                                        item?.crossCheckBy ? (
                                          <div className="d-flex flex-column">
                                            <span>
                                              {item?.crossCheckBy?.name}
                                            </span>
                                            <span>
                                              {item?.crossCheckBy?.city}
                                            </span>
                                            <span>
                                              {item?.crossCheckBy?.state}
                                            </span>
                                            <span>{`${formattedDate(item?.crossCheckBy?.date)} ${formatedTime(item?.crossCheckBy?.date)}`}</span>
                                          </div>
                                        ) : (
                                          <span
                                            onClick={() =>
                                              checkedBy(
                                                item?.orderId,
                                                "second",
                                                false,
                                              )
                                            }
                                          >
                                            <FontAwesomeIcon
                                              className="fa fa-pencil-square icon-home icon-banner checkd"
                                              icon={faSquareCheck}
                                            />
                                          </span>
                                        )
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                    <td>{item.userState}</td>
                                    <td>{item.userCity}</td>
                                    <td
                                      style={{
                                        maxWidth: 150,
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                      }}
                                    >
                                      {item?.userBankName}
                                    </td>
                                    <td>
                                      <CustomInputField
                                        item={item}
                                        getData={filterTransaction}
                                        User={User}
                                      />
                                    </td>
                                    <td>{item?.accountNumber}</td>
                                    <td>{item?.ifsc ?? "-"}</td>
                                    <td>{item?.aadhaarNumber}</td>
                                    {/* <td>{item.UTR}</td> */}
                                    <td>{item.orderId}</td>
                                    <td>{item?.orderKeyID}</td>
                                    {/* <td>{`${item.paymentGatewayName} - ${item.mid}`}</td> */}
                                    <td>{item?.userId}</td>
                                    {/* <td>{formattedDate(item.createdOn)}</td> */}
                                    {/* <td
                                      style={{
                                        border: "none",
                                        backgroundColor: "transparent",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                          justifyContent: "center",
                                          alignItems: "center",
                                        }}
                                        onClick={() => {
                                          if (
                                            (item.status?.toLowerCase() ===
                                              "pending" ||
                                              item.status?.toLowerCase() ===
                                                "processing") &&
                                            User?.data?.Responsibilities?.includes(
                                              Responsibilities?.Deposit_Pensil
                                            )
                                          ) {
                                            openEditDialog(item);
                                          }
                                        }}
                                      >
                                        <span>
                                          {formattedDate(item.createdOn)}
                                        </span>
                                        <span>
                                          {formatedTime(item.createdOn)}
                                        </span>
                                        <span>{item.status}</span>
                                      </div>
                                    </td>
                                    <td>{formatedTime(item.createdOn)}</td>
                                    <td>
                                      {item.status}
                                      {(item.status.toLowerCase() ===
                                        "pending" ||
                                        item.status.toLowerCase() ===
                                          "processing") && (
                                        <>
                                          {User.data.Responsibilities?.includes(
                                            Responsibilities?.Deposit_Pensil
                                          ) && (
                                            <span
                                              style={{
                                                verticalAlign: "middle",
                                                marginLeft: "1rem",
                                              }}
                                            >
                                              <FontAwesomeIcon
                                                className="fa fa-pencil-square icon-home icon-banner"
                                                icon={faPencilSquare}
                                                style={{ cursor: "pointer" }}
                                                onClick={() =>
                                                  openEditDialog(item)
                                                }
                                              />
                                            </span>
                                          )}
                                          {User.data.Responsibilities?.includes(
                                            Responsibilities?.Deposit_Pensil
                                          ) && (
                                            <Button
                                              onClick={() =>
                                                handleRejectPopup(item.orderId)
                                              }
                                              variant="contained"
                                              className="btn-withdraw"
                                            >
                                              Reject
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </td> */}
                                    <td>{item?.paymentType}</td>
                                    {/* <td>
                                      {item?.updatedTime
                                        ? formatedTime(item?.updatedTime)
                                        : ""}
                                    </td> */}
                                    <td>
                                      {item.kyc === false ? "Kyc not done" : ""}
                                    </td>
                                    <td
                                      style={{
                                        //  maxWidth: 1000,
                                        minWidth: "300px",
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                      }}
                                    >
                                      {item.reason}
                                    </td>
                                    <td>{item.upiId ?? "-"}</td>
                                    <td className="align-top user-upi-cell">
                                      {item?.userDepositUpiIds?.length ? (
                                        <div className="user-upi-list">
                                          {chunkArray(
                                            Array.isArray(
                                              item?.userDepositUpiIds,
                                            )
                                              ? item.userDepositUpiIds
                                              : String(
                                                  item.userDepositUpiIds,
                                                ).split(","),
                                            3,
                                          ).map(
                                            (
                                              row: any[],
                                              rowIndex: number,
                                            ) => (
                                              <div
                                                key={rowIndex}
                                                className="user-upi-row"
                                              >
                                                {row.map(
                                                  (
                                                    subData: any,
                                                    i: number,
                                                  ) => (
                                                    <span
                                                      key={i}
                                                      className="user-upi-chip"
                                                    >
                                                      {typeof subData ===
                                                      "string"
                                                        ? subData.trim()
                                                        : subData?.upiId ||
                                                          subData?.upi ||
                                                          "-"}
                                                    </span>
                                                  ),
                                                )}
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      ) : (
                                        "-"
                                      )}
                                    </td>

                                    <td>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                          justifyContent: "center",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span>
                                          {item?.updatedByName
                                            ? item?.updatedByName
                                            : ""}
                                        </span>
                                        <span>
                                          {item?.updatedTime
                                            ? formatedTime(item?.updatedTime)
                                            : ""}
                                        </span>
                                      </div>
                                      {/* {item?.updatedByName
                                        ? item?.updatedByName
                                        : ""} */}
                                    </td>
                                    {/* <td>
                                      {item?.updatedTime
                                        ? formatedTime(item?.updatedTime)
                                        : ""}
                                    </td> */}
                                  </tr>
                                )
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {requestType == "scanner" && (
                        <table className="table table-view">
                          <thead>
                            <tr>
                              <th className="text-center">
                                Transaction <br /> Type
                              </th>
                              <th className="text-center">
                                User <br /> Name
                              </th>
                              {User?.data?.Responsibilities?.includes(
                                Responsibilities.contact_visibility_none,
                              ) === false && (
                                <th className="text-center">
                                  Mobile <br /> No
                                </th>
                              )}
                              <th className="text-center">
                                App <br /> Name
                              </th>
                              <th className="text-center">Balance</th>
                              <th className="text-center">State</th>
                              <th className="text-center">City</th>
                              <th className="text-center">Given By</th>
                              <th className="text-center">Reason</th>
                              <th className="text-center">
                                Remark <br />
                              </th>
                              <th className="text-center">
                                User <br /> Id
                              </th>
                              <th className="text-center">UTR </th>
                              <th className="text-center">Date </th>
                              <th className="text-center">Time </th>
                              <th className="text-center">Last Activity</th>
                            </tr>
                          </thead>
                          <thead>
                            <tr className="bg-table">
                              <th className="thdr">
                                <FormControl fullWidth>
                                  <InputLabel
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "bold",
                                      marginTop: "3px",
                                    }}
                                    id="demo-simple-select-label"
                                  >
                                    Select Payment Type
                                  </InputLabel>
                                  <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    value={requestType}
                                    label="Status"
                                    onChange={(e: any) =>
                                      setRequestType(e.target.value)
                                    }
                                  >
                                    <MenuItem value={"automatic"}>
                                      Automatic
                                    </MenuItem>
                                    <MenuItem value={"scanner"}>
                                      scanner data
                                    </MenuItem>
                                    <MenuItem value={"instantDeposit"}>
                                      Instant Deposit
                                    </MenuItem>
                                  </Select>
                                </FormControl>
                              </th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>

                              <th className="thdr">
                                <Select
                                  labelId="demo-select-small-label"
                                  id="demo-select-small"
                                  label="Select App Name"
                                  value={scannerAppClientName}
                                  onChange={Handle_Scanner_App_Client_Name}
                                >
                                  {(!User?.data?.allotedApps
                                    ? Client_Names
                                    : Client_Names.filter((appName) =>
                                        User?.data?.allotedApps?.includes(
                                          appName,
                                        ),
                                      )
                                  ).map((appName: any, index: number) => (
                                    <MenuItem key={index} value={appName}>
                                      {appName}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {scannerData?.map((item: any, index: any) => (
                              <tr id={item._id}>
                                <td>
                                  {index +
                                    1 +
                                    (currentPage && itemsPerPage
                                      ? (currentPage - 1) * itemsPerPage
                                      : 0)}
                                </td>
                                <td
                                  onClick={() => {
                                    const url = `/user-report/${item.userId}/${item.userName}`;
                                    window.open(url, "_self");
                                  }}
                                  style={{ cursor: "pointer" }}
                                >
                                  {item.userName}
                                </td>
                                {User?.data?.Responsibilities?.includes(
                                  Responsibilities.show_mobile,
                                ) ? (
                                  <td>
                                    {`****** ${item?.userMobile?.slice(-4)}`}
                                    <ContentCopyIcon
                                      onClick={() =>
                                        copyMobile(item?.userMobile)
                                      }
                                      style={{
                                        color: "#333",
                                        fontSize: "17px",
                                        marginLeft: "10px",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </td>
                                ) : (
                                  <td>{"-"}</td>
                                )}
                                <td>{item?.clientName}</td>
                                <td>{item.balance}</td>
                                <td>{item.state}</td>
                                <td>{item.city}</td>
                                <td>{item?.updatedBy.name}</td>
                                <td>{item?.reason}</td>
                                <td>{item?.remakr}</td>
                                <td>{item?.userId}</td>
                                <td>{item?.utr}</td>
                                <td>
                                  {item.createdOn
                                    ? formattedDate(item?.createdOn)
                                    : ""}
                                </td>
                                <td>
                                  {item?.createdOn
                                    ? formatedTime(item?.createdOn)
                                    : ""}
                                </td>
                                <td>
                                  {item?.updatedOn
                                    ? formattedDate(item?.updatedOn) +
                                      " | " +
                                      formatedTime(item?.updatedOn)
                                    : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {requestType == "instantDeposit" && (
                        <table className="table table-view">
                          <thead>
                            <tr>
                              <th className="text-center">
                                Transaction <br /> Type
                              </th>
                              <th className="text-center">
                                User <br /> Name
                              </th>
                              {User?.data?.Responsibilities?.includes(
                                Responsibilities.contact_visibility_none,
                              ) === false && (
                                <th className="text-center">
                                  Mobile <br /> No
                                </th>
                              )}
                              <th className="text-center">
                                App <br /> Name
                              </th>
                              <th className="text-center">Amount</th>
                              <th className="text-center">Balance</th>
                              <th className="text-center">State</th>
                              <th className="text-center">City</th>
                              <th className="text-center">Given By</th>
                              <th className="text-center">Reason</th>
                              <th className="text-center">
                                Remark <br />
                              </th>
                              <th className="text-center">
                                User <br /> Id
                              </th>
                              <th className="text-center">UTR </th>
                              <th className="text-center">Date </th>
                              <th className="text-center">Time </th>
                              <th className="text-center">Last Activity</th>
                            </tr>
                          </thead>
                          <thead>
                            <tr className="bg-table">
                              <th className="thdr">
                                <FormControl fullWidth>
                                  <InputLabel
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "bold",
                                      marginTop: "3px",
                                    }}
                                    id="demo-simple-select-label"
                                  >
                                    Select Payment Type
                                  </InputLabel>
                                  <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    value={requestType}
                                    label="Status"
                                    onChange={(e: any) =>
                                      setRequestType(e.target.value)
                                    }
                                  >
                                    <MenuItem value={"automatic"}>
                                      Automatic
                                    </MenuItem>
                                    <MenuItem value={"scanner"}>
                                      scanner data
                                    </MenuItem>
                                    <MenuItem value={"instantDeposit"}>
                                      Instant Deposit
                                    </MenuItem>
                                  </Select>
                                </FormControl>
                              </th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>

                              <th className="thdr">
                                <Select
                                  labelId="demo-select-small-label"
                                  id="demo-select-small"
                                  label="Select App Name"
                                  value={scannerAppClientName}
                                  onChange={Handle_Scanner_App_Client_Name}
                                >
                                  {(!User?.data?.allotedApps
                                    ? Client_Names
                                    : Client_Names.filter((appName) =>
                                        User?.data?.allotedApps?.includes(
                                          appName,
                                        ),
                                      )
                                  ).map((appName: any, index: number) => (
                                    <MenuItem key={index} value={appName}>
                                      {appName}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                              <th className="thdr"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {depositData
                              ?.filter(
                                (subData: any) => subData?.instantDeposit,
                              )
                              ?.map((item: any, index: any) => (
                                <tr id={item._id}>
                                  <td>
                                    {index +
                                      1 +
                                      (currentPage && itemsPerPage
                                        ? (currentPage - 1) * itemsPerPage
                                        : 0)}
                                  </td>
                                  <td
                                    onClick={() => {
                                      const url = `/user-report/${item.userId}/${item.userName}`;
                                      window.open(url, "_self");
                                    }}
                                    style={{ cursor: "pointer" }}
                                  >
                                    {item.userName}
                                  </td>
                                  {User?.data?.Responsibilities?.includes(
                                    Responsibilities.contact_visibility_none,
                                  ) === false && (
                                    <td>
                                      {`****** ${item?.userMobile?.slice(-4)}`}
                                      <ContentCopyIcon
                                        onClick={() =>
                                          copyMobile(item?.userMobile)
                                        }
                                        style={{
                                          color: "#333",
                                          fontSize: "17px",
                                          marginLeft: "10px",
                                          cursor: "pointer",
                                        }}
                                      />
                                    </td>
                                  )}
                                  <td>{item?.clientName}</td>
                                  <td>{item?.amount}</td>
                                  <td>{item.balance}</td>
                                  <td>{item.state}</td>
                                  <td>{item.city}</td>
                                  <td>{item?.updatedBy.name}</td>
                                  <td>{item?.reason}</td>
                                  <td>{item?.remakr}</td>
                                  <td>{item?.userId}</td>
                                  <td>{item?.utr}</td>
                                  <td>
                                    {item.createdOn
                                      ? formattedDate(item?.createdOn)
                                      : ""}
                                  </td>
                                  <td>
                                    {item?.createdOn
                                      ? formatedTime(item?.createdOn)
                                      : ""}
                                  </td>
                                  <td>
                                    {item?.updatedOn
                                      ? formattedDate(item?.updatedOn) +
                                        " | " +
                                        formatedTime(item?.updatedOn)
                                      : ""}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {requestType == "automatic" && (
                      <ul className="pagination  justify-content-center">
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
                    )}
                  </div>
                </div>
                <div>
                  <Dialog
                    open={openPopup}
                    onClose={() => {
                      setOpenPopup(false);
                      setUtrNo("");
                      setUtrSlipName("");
                    }}
                  >
                    <DialogContent className="flow-off">
                      <form onSubmit={handleSubmit}>
                        <h6>Manual settle Transaction</h6>
                        <div className="parent-container">
                          <div className="centered-div">
                            <div className="mt-2 text-inp">
                              <label>Amount</label>
                              <TextField
                                variant="outlined"
                                size="small"
                                className="mt-1"
                                value={editedAmount}
                                onChange={(e: any) =>
                                  setEditedAmount(Number(e.target.value))
                                }
                                disabled={true}
                                type={"number"}
                                fullWidth={true}
                              />
                            </div>
                            <div className="mt-2 text-inp">
                              <label>Client Txnid</label>
                              <TextField
                                variant="outlined"
                                size="small"
                                className="mt-1"
                                value={depositItem?.orderKeyID || "-"}
                                disabled={true}
                                type={"text"}
                                fullWidth={true}
                              />
                            </div>
                            <div className="mt-2 text-inp">
                              <label>User UPI ID</label>
                              <TextField
                                variant="outlined"
                                size="small"
                                className="mt-1"
                                value={
                                  Array.isArray(depositItem?.userDepositUpiIds)
                                    ? depositItem.userDepositUpiIds
                                        .filter(Boolean)
                                        .join(", ") || "-"
                                    : depositItem?.userDepositUpiIds || "-"
                                }
                                disabled={true}
                                type={"text"}
                                fullWidth={true}
                                multiline
                              />
                            </div>
                            <div className="mt-1 text-inp">
                              <label>Reason</label>
                              <div className="mt-2 text-inp">
                                <FormControl fullWidth>
                                  <InputLabel id="demo-simple-select-label">
                                    Select Reason
                                  </InputLabel>
                                  <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    value={selectedReason}
                                    label="Status"
                                    onChange={(e: any) =>
                                      setSelectedReason(e.target.value)
                                    }
                                  >
                                    <MenuItem value={"deposit-uco-trpl"}>
                                      deposit-uco-trpl
                                    </MenuItem>
                                    <MenuItem value={"Deposit Failure"}>
                                      Deposit Failure
                                    </MenuItem>
                                    <MenuItem
                                      value={`manual-deposit-${depositItem?.paymentGatewayName?.replace(/\t/g, "")}`}
                                    >
                                      {`manual-deposit-${depositItem?.paymentGatewayName?.replace(/\t/g, "")}`}
                                    </MenuItem>
                                    <MenuItem value={"instant-deposit-manual"}>
                                      instant-deposit-manual
                                    </MenuItem>
                                    <MenuItem value={"deposit-upi-id"}>
                                      deposit-upi-id
                                    </MenuItem>
                                    <MenuItem value={"deposit-sapt-rishi"}>
                                      deposit-sapt-rishi
                                    </MenuItem>
                                    <MenuItem value={"deposit-manual"}>
                                      deposit-manual
                                    </MenuItem>
                                  </Select>
                                </FormControl>
                              </div>
                              {/* <TextField variant="outlined" size="small" className="mt-2" value={"Deposit failure"} type={"text"} disabled fullWidth={true} /> */}
                            </div>

                            <div className="mt-1 mb-2 text-inp">
                              <label>Mid</label>
                              <Autocomplete
                                options={(paymentGetwayNames || [])
                                  .map((g: any) => g?.mid)
                                  .filter((m: any) => !!m)}
                                value={selectedDialogMid || ""}
                                onChange={(
                                  event: any,
                                  newValue: string | null,
                                ) => setSelectedDialogMid(newValue || "")}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    variant="outlined"
                                    size="small"
                                    className="mt-2"
                                    label="Select MID"
                                    fullWidth={true}
                                  />
                                )}
                                clearOnBlur={false}
                                handleHomeEndKeys
                                autoHighlight
                                disableClearable={false}
                              />
                            </div>

                            <div className="mt-1 mb-2 text-inp">
                              <label>Gateway Name</label>
                              <Autocomplete
                                options={(payInGatewayName || [])
                                  .map((g: any) => g)
                                  .filter((m: any) => !!m)}
                                value={selectedPayinGatewayName || ""}
                                onChange={(
                                  event: any,
                                  newValue: string | null,
                                ) =>
                                  setSelectedPayinGatewayName(newValue || "")
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    variant="outlined"
                                    size="small"
                                    className="mt-2"
                                    label="Select Payment Gateway"
                                    fullWidth={true}
                                  />
                                )}
                                clearOnBlur={false}
                                handleHomeEndKeys
                                autoHighlight
                                disableClearable={false}
                              />
                            </div>

                            <div className="mt-2 text-inp">
                              <label>Date</label>
                              <input
                                type="date"
                                className="form-control"
                                placeholder="To Date"
                                value={selectdate}
                                min={
                                  User?.data?.Responsibilities?.includes(
                                    Responsibilities.show_back_date,
                                  )
                                    ? ""
                                    : new Date(
                                        Date.now() - 3 * 24 * 60 * 60 * 1000,
                                      )
                                        .toISOString()
                                        .split("T")[0]
                                }
                                max={
                                  new Date(
                                    new Date().getTime() + 5.5 * 60 * 60 * 1000,
                                  )
                                    .toISOString()
                                    .split("T")[0]
                                }
                                onChange={(e) => setSelectDate(e.target.value)}
                              />
                            </div>
                            <div className="mt-1 mb-2 text-inp">
                              <label>Remark</label>
                              <TextField
                                variant="outlined"
                                multiline={true}
                                rows={3}
                                className="mt-2"
                                value={`Deposite failure of ${depositItem?.userName} through ${depositItem?.paymentGatewayName} with order id ${depositItem?.orderId}`}
                                type={"text"}
                                disabled
                                fullWidth={true}
                              />
                            </div>
                            <div className="mt-1 mb-2 text-inp">
                              <label>UTR No</label>
                              <div className="mt-1 d-flex align-items-center gap-2">
                                <input
                                  ref={utrFileInputRef}
                                  type="file"
                                  accept="image/*,.jpg,.jpeg,.png,.webp"
                                  style={{ display: "none" }}
                                  onChange={handleUtrSlipUpload}
                                />
                                <Button
                                  variant="outlined"
                                  size="small"
                                  disabled={utrReading}
                                  onClick={() =>
                                    utrFileInputRef.current?.click()
                                  }
                                  sx={{
                                    minWidth: "auto",
                                    padding: "2px 8px",
                                    fontSize: "11px",
                                    lineHeight: 1.2,
                                    textTransform: "none",
                                  }}
                                >
                                  {utrReading ? "Reading..." : "Upload Slip"}
                                </Button>
                                {utrSlipName && (
                                  <span
                                    style={{ fontSize: "12px", color: "#666" }}
                                  >
                                    {utrSlipName}
                                  </span>
                                )}
                              </div>
                              <TextField
                                variant="outlined"
                                size="small"
                                className="mt-2"
                                placeholder="UTR will appear here after upload"
                                value={utrNo}
                                onChange={(e: any) => setUtrNo(e.target.value)}
                                type={"text"}
                                fullWidth={true}
                              />
                            </div>
                          </div>
                        </div>
                        <DialogActions>
                          <Button
                            className="btn-popup"
                            variant="outlined"
                            onClick={() => {
                              setOpenPopup(false);
                              setUtrNo("");
                              setUtrSlipName("");
                            }}
                            color="primary"
                          >
                            Cancel
                          </Button>
                          <Button
                            className="btn-popup"
                            variant="outlined"
                            type="submit"
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
                    open={openRejectPopup}
                    onClose={() => setOpenRejectPopup(false)}
                  >
                    <DialogContent className="flow-off">
                      <form onSubmit={rejectDeposit}>
                        <div className="parent-container">
                          <div className="centered-div">
                            <div className="mt-1 mb-2 text-inp">
                              <label>Enter Reject Reason</label>
                              <TextField
                                label={"Please enter the reason"}
                                error={rejectReasonError}
                                helperText={rejectReasonHelperText}
                                value={rejectReason}
                                variant="outlined"
                                multiline={true}
                                rows={3}
                                className="mt-2"
                                type={"text"}
                                fullWidth={true}
                                onChange={handleRejectReason}
                              />
                            </div>
                          </div>
                        </div>
                        <DialogActions>
                          <Button
                            className="btn-popup"
                            variant="outlined"
                            onClick={() => setOpenRejectPopup(false)}
                            color="primary"
                          >
                            Cancel
                          </Button>
                          <Button
                            className="btn-popup"
                            variant="outlined"
                            type="submit"
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
                    open={showUpdateFieldPopup}
                    onClose={() => setShowUpdateFieldPopup(false)}
                  >
                    <DialogContent>
                      <div>
                        {/* <Reusable_Input
                          type="text"
                          label={
                            updateType === "mid"
                              ? "Mid"
                              : updateType === "displayName"
                              ? "Display Name"
                              : updateType === "redirectionLink"
                              ? "Redirection Link"
                              : "Link"
                          }
                          fullWidth={true}
                          value={updateTextVal}
                          error={updateTextError}
                          // helperText={gatewayNameHelperText}
                          onChange={handleUpdateText}
                        /> */}
                        <Select
                          labelId="demo-simple-select-label"
                          id="demo-simple-select"
                          value={selectedGateway?.mid}
                          label="Status"
                          onChange={(e) => {
                            const selectedGateway: any =
                              paymentGetwayNames.find(
                                (gateway: any) =>
                                  gateway?.mid === e.target.value,
                              );
                            setUpdateTextVal(selectedGateway?.mid);
                          }}
                        >
                          {paymentGetwayNames?.length > 0 &&
                            paymentGetwayNames.map(
                              (gateWay: any, index: number) => (
                                <MenuItem
                                  key={`gateWay._${index}`}
                                  value={gateWay.mid}
                                >
                                  {gateWay?.mid}
                                </MenuItem>
                              ),
                            )}
                        </Select>
                      </div>
                      <DialogActions className="mt-3">
                        <Button
                          className="btn-popup"
                          variant="outlined"
                          onClick={() => setShowUpdateFieldPopup(false)}
                          color="primary"
                        >
                          Cancel
                        </Button>
                        <Button
                          className="btn-popup"
                          variant="outlined"
                          type="submit"
                          color="primary"
                          onClick={() => updateGateWayDetails()}
                        >
                          Update
                        </Button>
                      </DialogActions>
                    </DialogContent>
                  </Dialog>
                </div>
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
                </footer>
              </div>
            </div>
          </main>
        </div>
      )}
      <UpdateMidModal
        open={updateMidModalOpen}
        onClose={() => setUpdateMidModalOpen(false)}
        selectedOrders={selectedOrders}
        midOptions={paymentGetwayNames}
        paymentGatewayOptions={payInGatewayName}
        onSuccess={handleUpdateMidSuccess}
        setLoading={setLoading}
      />
      <OtpModal
        isOpen={donwloadModalShown}
        onClose={() => setDownloadModalShown(false)}
        onOtpSubmit={() => downloadExcel()}
        locationInfo={locationInfo}
        address={address}
        userData={User}
        filterData={{
          mid: selectedGateway?.mid || "All",
          type: "Deposit",
        }}
      />
    </>
  );
}
export default React.memo(Deposit);
