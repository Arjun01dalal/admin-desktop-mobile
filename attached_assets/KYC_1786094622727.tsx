import React, {
  ChangeEvent,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "../../../../Css/style.css";
import "../../../../Css/table.css";
import "../../../../Css/users.css";
import "./KYC.css";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Button from "@mui/material/Button";
import axios from "axios";
import { API_Endpoint } from "../../../../Configuration/Settings";
import * as lodash from "lodash";
import {
  Pagination,
  Stack,
  TextField,
  Select,
  SelectChangeEvent,
  MenuItem,
} from "@mui/material";
import Loader from "../../../../Components/Loader/Loader";
import { Responsibilities } from "../../../../Configuration/Enums";
import { User_Context } from "../../../../Contexts/User";
import { useNavigate } from "react-router-dom";
import { decryptData } from "../../../../utils/decryptData";
import { encryptData } from "../../../../utils/encryptData";
import { fetchUserGetAll } from "../../../../API/userGetAll";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import SearchBar from "../../../../Components/SearchBox/Search";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import { dateTime } from "../../../../utils/utility";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Client_Names } from "../../../../Configuration/Enums";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { Dialog, DialogActions, DialogContent } from "@material-ui/core";
import { formatedTime } from "../../../../utils/utility";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquareCheck } from "@fortawesome/free-solid-svg-icons";
import { API_Handler } from "../../../../API/API_Handler";
import { faPencilSquare } from "@fortawesome/free-solid-svg-icons";
import OtpModal from "../../../../Components/OTPInput/OtpModal";
import useLocation from "../../../../Hooks/useLocation";

function Userkyc() {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [Files, Set_Files] = useState<string[]>([]);
  const [File_Extensions, Set_File_Extensions] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [IFSCs, Set_IFSCs] = useState<string[]>([]);
  const [KYCs, Set_KYCs] = useState<boolean[]>([]);
  const [Bank_Accounts, Set_Bank_Accounts] = useState<string[]>([]);
  const [Aadhar_Number, set_Aadhar_Number] = useState<string[]>([]);
  const [UPIId, setUpiId] = useState<string[]>([]);
  const { User } = useContext<any>(User_Context);
  const Navigate = useNavigate();
  const [searchUserName, setSearchUserName] = useState<string>("");
  const [searchMob, setSearchMob] = useState<string>("");
  const [searchAccNo, setSearchAccNo] = useState<string>("");
  const [searchAadharNo, setSearchAadharNo] = useState<string>("");
  const [searchUserId, setSearchUserId] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [openPopup, setOpenPopup] = useState(false);
  const [manualUserBankName, setManualUserBankName] = useState<string>("");
  const [manualBankName, setManualBankName] = useState<string>("");
  const [manualUserAadhar, setManualUserAadhar] = useState<string>("");
  const [manualUserIfsc, setManualUserIfsc] = useState<string>("");
  const [userUPIID, setUserUPIID] = useState<string>("");
  const [manualUserAccNo, setManualUserAccNo] = useState<string>("");
  const [payloadId, setPayloadId] = useState<string>("");
  const [appClientName, setAppClientName] = useState("");
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [inputOTP, setInputOTP] = useState("");
  const [adminOtp, setAdminOTP] = useState("");
  const [comment, setComment] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>({});
  const [showDocOTPModal, setShowDocOTPModal] = useState(false);
  const [showManualKycOTPModal, setShowManualKycOTPModal] = useState(false);
  const [uploadDocItemIndex, setUploadDocItemIndex] = useState<number>(0);
  const [showAppoveOTPModal, setShowApproveOTPModal] = useState(false);
  const [showUPIIDModal, setShowUPIIDModal] = useState<boolean>(false);
  const [isKycModal, setIskYCModal] = useState<boolean>(false);
  const [selectUserId, setSelectUserId] = useState<string>("");
  const [isNightLockActive, setIsNightLockActive] = useState(false);
  const [userUpiId, setUserUpiId] = useState("");
  const [btnClickID, setBtnClickedID] = useState("");
  const [enableOtpFlow, setEnableOtpFlow] = useState(false);
  const locationInfo = useLocation();
  const [address, setAddress] = useState<any>({});
  const [disableCheck, setDisableCheck] = useState(false);

  const Handle_App_Client_Name = (event: SelectChangeEvent<string>) => {
    setAppClientName(event.target.value);
  };

  const Change_IFSC = (IFSC: string, Index: number): void =>
    Set_IFSCs(
      IFSCs.map((IFSC_Value: string, IFSC_Index: number) =>
        IFSC_Index === Index ? IFSC : IFSC_Value,
      ),
    );
  const Change_Bank_Account = (Bank_Account: string, Index: number): void =>
    Set_Bank_Accounts(
      Bank_Accounts.map(
        (Bank_Account_Value: string, Bank_Account_Index: number) =>
          Bank_Account_Index === Index ? Bank_Account : Bank_Account_Value,
      ),
    );
  const Change_Aadhar_Number = (val: string, Index: number): void =>
    set_Aadhar_Number(
      Aadhar_Number.map((value: string, i: number) =>
        i === Index ? val : value,
      ),
    );
  // const Change_UpiID = (val: string, Index: number): void =>{
  //   console.log("val:::", val, Index,UPIId);

  //   setUpiId(
  //     UPIId.map((Bank_Account_Value: string, Bank_Account_Index: number) =>
  //       Bank_Account_Index === Index ? val : Bank_Account_Value,
  //     ),
  //   );}
  const Change_UpiID = (val: string, index: number): void => {
    setUpiId((prev: string[] = []) =>
      Array.from({ length: Math.max(prev.length, index + 1) }, (_, i) =>
        i === index ? val : prev[i] || "",
      ),
    );
  };
  const Change_File = (Base64_File: string, Index: number): void =>
    Set_Files(
      Files.map((File_Value: string, File_Index: number) =>
        File_Index === Index ? Base64_File : File_Value,
      ),
    );
  const Change_KYC = (KYC: boolean, Index: number): void =>
    Set_KYCs(
      KYCs.map((KYC_Value: boolean, KYC_Index: number) =>
        KYC_Index === Index ? KYC : KYC_Value,
      ),
    );

  const handleOTPInput = (event: ChangeEvent<HTMLInputElement>) => {
    setInputOTP(event.target.value);
  };

  const handleUserUPIInput = (event: ChangeEvent<HTMLInputElement>) => {
    setUserUpiId(event.target.value);
  };

  const handleManualUserBankName = (event: ChangeEvent<HTMLInputElement>) => {
    setManualUserBankName(event.target.value);
  };

  const handleManualBankName = (event: ChangeEvent<HTMLInputElement>) => {
    setManualBankName(event.target.value);
  };

  const handleManualUserAadhar = (event: ChangeEvent<HTMLInputElement>) => {
    setManualUserAadhar(event.target.value);
  };

  const handleManualUserIfsc = (event: ChangeEvent<HTMLInputElement>) => {
    setManualUserIfsc(event.target.value.toUpperCase());
  };

  const handleManualUserAccNo = (event: ChangeEvent<HTMLInputElement>) => {
    setManualUserAccNo(event.target.value);
  };

  const handleSearchUserId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserId(event.target.value);
  };
  const handleSearchUserName = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchUserName(event.target.value);
  };
  const handleSearchUserMob = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchMob(event.target.value);
  };
  const handleSearchAccNo = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchAccNo(event.target.value);
  };
  const handleSearchAadharNo = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchAadharNo(event.target.value);
  };

  const applyKycResult = (result: {
    items: any[];
    totalPages: number;
    payload?: any;
  }) => {
    setData(result.items);
    setTotalPages(result.totalPages);
    Set_Bank_Accounts(result.items.map((Item: any) => Item.accountNumber));
    Set_IFSCs(result.items.map((Item: any) => Item.ifsc));
    set_Aadhar_Number(result.items.map((Item: any) => Item.aadhaarNumber));
    setUpiId(result.items.map((Item: any) => Item.upiId));
    Set_Files(result.items.map((Item: any) => Item.aadhaarImageBase64));
    Set_KYCs(result.items.map((Item: any) => Item.kyc));
  };

  const filterTransaction = () => {
    if (!startDate) {
      toast("Please select from date");
    } else if (!endDate) {
      toast("Please select to date");
    } else {
      setLoading(true);
      let data = {
        itemsPerPage: itemsPerPage,
        pageNo: currentPage,
        filter: {},
        startDate: dateTime(startDate),
        endDate: dateTime(endDate),
      };
      const token = localStorage.getItem("token");
      if (token) {
        fetchUserGetAll(data, { force: true, token })
          .then((result) => {
            console.log("KYC data", result.payload);
            if (result.items.length <= 0) {
              toast("No kyc registered for selected date");
            }
            applyKycResult(result);
            setLoading(false);
          })
          .catch((error) => {
            setLoading(false);
          });
      }
    }
  };

  const filterUser = (options?: { force?: boolean }) => {
    setLoading(true);
    const filter: {
      _id?: string;
      mobile?: string;
      name?: string;
      accountNumber?: string;
      aadhaarNumber?: string;
      clientName?: String;
    } = {};
    if (searchUserId) {
      filter._id = searchUserId;
    }
    if (searchUserName) {
      filter.name = searchUserName;
    }
    if (searchMob) {
      filter.mobile = searchMob;
    }
    if (searchAccNo) {
      filter.accountNumber = searchAccNo;
    }
    if (searchAadharNo) {
      filter.aadhaarNumber = searchAadharNo;
    }
    if (appClientName) {
      filter.clientName = appClientName;
    }
    let data = {
      itemsPerPage: itemsPerPage,
      pageNo: currentPage,
      filter: filter,
    };
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserGetAll(data, { force: options?.force, token })
        .then((result) => {
          console.log("KYC data", result.payload);
          applyKycResult(result);
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
  };

  // Single load path — avoids duplicate getData + filterUser (+ StrictMode double-invoke)
  useEffect(() => {
    filterUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, appClientName]);

  const handlePerPage = (newValue: any) => {
    setItemsPerPage(newValue);
  };

  const handleImageClick = (image: string | null): void => {
    setEnlargedImage(image);
  };

  const closeEnlargedImage = () => {
    setEnlargedImage(null);
  };

  const formatDate = (dateString: string) => {
    const options = { year: "numeric", month: "long", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined);
  };

  const formatDateManual = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    Index: number,
  ) => {
    if (event.target.files) {
      const reader = new FileReader();
      reader.readAsDataURL(event.target.files[0]);
      reader.onload = () => {
        const Base64_Image = reader.result?.toString();
        Set_File_Extensions([
          ...File_Extensions.slice(0, Index),
          Base64_Image?.includes("jpg")
            ? "jpg"
            : Base64_Image?.includes("jpeg")
              ? "jpeg"
              : Base64_Image?.includes("png")
                ? "png"
                : "",
          ...File_Extensions.slice(Index + 1),
        ]);
        Change_File(Base64_Image as string, Index);
      };
    }
    setInputOTP("");
    setAdminOTP("");
    setShowDocOTPModal(false);
  };

  // for reject kyc
  const handleOTPSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `${API_Endpoint}/kyc/reject`;
      const payload = {
        _id: selectedItem?._id,
        mobile: selectedItem?.mobile,
        clientName: selectedItem?.clientName,
        otp: inputOTP,
        kycAdminOtp: adminOtp,
        updatedBy: {
          _id: User.data._id,
          name: User.data.name,
        },
      };
      console.log("payload /kyc/reject====>", payload);

      const response = await API_Handler.post(
        url,
        { token: encryptData(payload) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        setLoading(false);
        toast("KYC Rejected Successfully");
        setInputOTP("");
        setAdminOTP("");
        setShowOTPModal(false);
        filterUser({ force: true });
      }
    } catch (error: any) {
      setLoading(false);
      toast.error(error?.response?.data.message);
      console.error("Error in KYC rejection", error);
    }
  };

  const approveKYC = (e: any) => {
    e.preventDefault();
    setLoading(true);
    let payload = {
      accountNumber: Bank_Accounts?.[selectedItem?.index],
      otp: inputOTP,
      aadhaarNumber: Aadhar_Number?.[selectedItem?.index],
      _id: selectedItem?._id,
      upiId: UPIId?.[selectedItem?.index],
      kycAdminOtp: adminOtp,
      currentKycNote: comment,
      mobile: selectedItem?.mobile,
      clientName: selectedItem?.clientName,
      updatedBy: {
        _id: User.data._id,
        name: User.data.name,
      },

      //  accountNumber: Bank_Accounts?.[selectedItem?.index],
      // otp: inputOTP,
      // aadhaarNumber: Aadhar_Number?.[selectedItem?.index],
      // _id: selectedItem?._id,
      // upiId: UPIId?.[selectedItem?.index],
    };
    const kyc = async () => {
      try {
        const token = localStorage.getItem("token");
        const url = `${API_Endpoint}/kyc/kycAdminOtp`;

        await API_Handler.post(
          url,
          { token: encryptData(payload) },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
          .then((response) => {
            if (response.data.success) {
              toast.success("KYC Approved Successfully");
              Change_KYC(true, selectedItem?.index);
              setLoading(false);
              setInputOTP("");
              setAdminOTP("");
              setShowApproveOTPModal(false);
              filterUser({ force: true });
            } else {
              toast.error("KYC failed");
              setLoading(false);
            }
          })
          .catch((error) => {
            setLoading(false);
            toast.error(error.response.data.message);
            setInputOTP("");
            setAdminOTP("");
            setShowApproveOTPModal(false);
          });
      } catch (error: any) {
        setLoading(false);
        console.error("Error in KYC approval", error);
      }
    };
    kyc();
  };

  const validateUpiId = async (upiId: string, item: any) => {
    let token = User.token;
    if (!upiId) return { success: false, message: "UPI ID is required" };

    try {
      const res = await axios.post(
        `${API_Endpoint}/kyc/verify-upi`,
        { token: encryptData({ upiId }) },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "client-name": item?.clientName?.toUpperCase(),
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (res?.data?.success) {
        return { success: true };
      }
      return { success: false, message: "UPI verification failed" };
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Something went wrong";
      alert(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const sendAutomaticKycOTP = async (item: any) => {
    let token = User.token;
    let payload = {
      sendOTPToClient: false,
      mobile: item?.mobile,
      clientName: item?.clientName,
    };
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/kyc/send-otp`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: payload,
    };

    await API_Handler.request(config)
      .then((response) => {
        toast.success("Admin OTP Sent Successfully");
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
      });
  };

  const handleOpenApproveKYCOTPModal = async (item: any) => {
    if (Bank_Accounts?.[item?.index] === "") {
      toast.error("Enter Correct Bank Account Number");
      return;
    }
    if (Aadhar_Number?.[item?.index] === "") {
      toast.error("Enter Correct Aadhar Number");
      return;
    }
    if (IFSCs?.[item?.index] === "") {
      toast.error("Enter Correct IFSC Number");
      return;
    }
    if (UPIId?.[item?.index] === "") {
      toast.error("Enter Correct UPI ID");
      return;
    }
    let token = User.token;
    const payload = {
      accountNumber: Bank_Accounts?.[item?.index],
      ifsc: IFSCs?.[item?.index],
      aadhaarNumber: Aadhar_Number?.[item?.index],
    };
    setLoading(true);
    setSelectedItem({ ...item });
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/kyc/kyc`,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "client-name": item?.clientName?.toUpperCase(),
      },
      data: { token: encryptData(payload) },
    };

    await API_Handler.request(config)
      .then(async (response) => {
        console.log("response:::", response);
        const res = decryptData(response?.data?.data);
        if (response?.data?.success) {
          const upiValidation = await validateUpiId(UPIId?.[item?.index], item);
          console.log("upiValidation:::", upiValidation);
          if (upiValidation?.success) {
            toast.success("OTP Sent Successfully");
            sendAutomaticKycOTP(item);
            setShowApproveOTPModal(true);
          } else {
            toast.success(upiValidation?.message);
          }
        } else {
          toast?.error(response?.data?.message);
        }
      })
      .catch((error) => {
        alert(error?.response?.data?.message);
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const manualApproveSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputOTP) {
      toast.error("Please enter OTP");
      return;
    } else if (!adminOtp) {
      toast.error("Please enter Admin OTP");
      return;
    } else if (!/^\d{4}$/.test(inputOTP)) {
      toast.error("Please enter a valid 4 digit OTP");
      return;
    }
    if (!manualUserBankName) {
      toast.error("Please enter user bank name");
      return;
    }
    if (!manualBankName) {
      toast.error("Please enter bank name");
      return;
    }
    if (!manualUserAccNo) {
      toast.error("Please enter account no");
      return;
    }
    if (!manualUserAadhar) {
      toast.error("Please enter aadhar no");
      return;
    }
    if (!userUPIID) {
      toast.error("Please enter UPI ID");
      return;
    }
    if (!manualUserIfsc) {
      toast.error("Please enter ifsc code");
      return;
    }
    if (!manualUserIfsc) {
      toast.error("Please enter ifsc code");
      return;
    }
    if (!comment) {
      toast.error("Please enter Comment");
      return;
    }
    const token = localStorage.getItem("token");
    const payload = {
      userId: payloadId,
      aadhaarNumber: manualUserAadhar,
      upiId: userUPIID,
      accountNumber: manualUserAccNo,
      ifsc: manualUserIfsc,
      bankName: manualBankName,
      userBankName: manualUserBankName,
      mobile: selectedItem?.mobile,
      clientName: selectedItem?.clientName,
      otp: inputOTP,
      kycAdminOtp: adminOtp,
      currentKycNote: comment,
      updatedBy: {
        _id: User.data._id,
        name: User.data.name,
      },
    };
    console.log("payload /kyc/manualKycUpdate===>", payload);

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/kyc/manualKycUpdate`,
      headers: { Authorization: `Bearer ${token}` },
      data: { token: encryptData(payload) },
    };
    axios
      .request(config)
      .then(() => {
        setLoading(false);
        setOpenPopup(false);
        setManualUserBankName("");
        setManualBankName("");
        setManualUserAccNo("");
        setManualUserAadhar("");
        setManualUserIfsc("");
        filterUser({ force: true });
        setInputOTP("");
        setAdminOTP("");
      })
      .catch((error) => {
        toast.error(error?.response?.data.message);
        setLoading(false);
      });
  };

  const openManualPopup = (id: any) => {
    setOpenPopup(true);
    setPayloadId(id);
  };

  const closeManualPopup = () => {
    setOpenPopup(false);
    setManualUserBankName("");
    setManualBankName("");
    setManualUserAccNo("");
    setManualUserAadhar("");
    setManualUserIfsc("");
    setInputOTP("");
    setAdminOTP("");
  };

  const checkedBy = (itemId: string, check: string, status: boolean) => {
    // Save the current page before making the API call
    const currentPageBeforeUpdate = currentPage;

    let data = {
      _id: itemId,
      check: check,
      updatedBy: {
        name: User.data.name,
        userId: User.data._id,
        status: status,
      },
    };
    const token = localStorage.getItem("token");
    console.log("Decrypted Payload====>", data);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/kyc/check-reject-kyc`,
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
          filterUser({ force: true });
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  // check before upload documnet
  const checkBeforUploadDoc = (
    itemId: string,
    check: string,
    status: boolean,
  ) => {
    const currentPageBeforeUpdate = currentPage;

    let data = {
      _id: itemId,
      check: check,
      updatedBy: {
        name: User.data.name,
        userId: User.data._id,
        status: status,
      },
    };
    const token = localStorage.getItem("token");
    console.log("Decrypted Payload====>", data);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/Kyc/check-doc-kyc`,
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
          filterUser({ force: true });
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const checkBeforManualKyc = (
    itemId: string,
    check: string,
    status: boolean,
  ) => {
    // Save the current page before making the API call
    const currentPageBeforeUpdate = currentPage;

    let data = {
      _id: itemId,
      check: check,
      updatedBy: {
        name: User.data.name,
        userId: User.data._id,
        status: status,
      },
    };
    const token = localStorage.getItem("token");
    console.log("Decrypted Payload====>", data);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/Kyc/check-manual-kyc`,
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
          filterUser({ force: true });
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  // sent otp on user mobile
  const sendKYCOtp = async (mobile: string, clientName: string, item: any) => {
    let token = User.token;
    let payload = {
      sendOTPToClient: true,
      mobile: mobile,
      clientName: clientName,
    };
    setLoading(true);
    setSelectedItem({ ...item });
    console.log(payload);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/kyc/send-otp`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: payload,
    };

    await API_Handler.request(config)
      .then((response) => {
        let API_Response = response?.data?.data;
        toast.success("OTP Sent Successfully");
        setShowOTPModal(true);
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
      });
  };

  const sendManualKycOTP = async (
    mobile: string,
    clientName: string,
    item: any,
  ) => {
    let token = User.token;
    let payload = {
      sendOTPToClient: true,
      mobile: mobile,
      clientName: clientName,
    };
    setLoading(true);
    setSelectedItem({ ...item });
    console.log(payload);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/kyc/send-otp`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: payload,
    };

    await API_Handler.request(config)
      .then((response) => {
        let API_Response = response?.data?.data;
        toast.success("OTP Sent Successfully");
        openManualPopup(item?._id);
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
      });
  };

  // const handleManualKYCOtpSubmit = async (e: any) => {
  //   e.preventDefault();

  // };

  // copty mobile
  const copyMobile = async (textToCopy: any) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${textToCopy} Coppied`);
    } catch (err) {
      console.log(err);
    }
  };

  const updateUserUPIID = async () => {
    if (userUpiId === "") {
      toast.error(
        isKycModal ? "Enter correct Aadhar ID" : "Enter correct UPI ID",
      );
      return;
    }

    if (isKycModal && userUpiId?.length < 12) {
      toast.error("Aadhar No must be 12 digit");
      return;
    }

    let token = User.token;
    let payload: any = {
      _id: selectUserId,
    };
    if (isKycModal) {
      payload.aadhaarNumber = userUpiId;
    } else {
      payload.upiId = userUpiId;
    }
    //  setLoading(true);
    console.log(payload);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: isKycModal
        ? `${API_Endpoint}/User/update-aadhaar`
        : `${API_Endpoint}/User/upiIdWithdrawal`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: { token: encryptData(payload) },
    };

    await API_Handler.request(config)
      .then((response) => {
        let API_Response = decryptData(response?.data?.data);
        console.log("API_Response:::", API_Response);
        setData((prev: any) =>
          prev.map((item: any) =>
            item._id === selectUserId
              ? { ...item, ...API_Response?.payload }
              : item,
          ),
        );
        toast.success(
          isKycModal
            ? "Aadhar No Updated Successfully"
            : "UPI ID Updated Successfully",
        );
        setShowUPIIDModal(false);
        setSelectUserId("");
        setIskYCModal(false);
        setUserUpiId("");
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
        setSelectUserId("");
        setIskYCModal(false);
        setUserUpiId("");
      });
  };

  const connectToDialer = async (details: any) => {
    try {
      await axios.post(
        `https://api2.ganesha999.com/API/`,
        {
          list_id: `800001`,
          list_name: `KYC UPDATION`,
          campaign_id: "KYC",
          leads: [
            {
              first_name: details?.name,
              last_name: "",
              phone_number: details?.mobile,
              city: details?.city ?? "",
              state: details?.state ?? "",
              email: details?.clientName ?? details?.app_name ?? "",
              comments: details?.clientName ?? details?.app_name ?? "",
              province: details?._id,
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      toast.success("Data sent successfully");
      setBtnClickedID(details?._id);
    } catch (error) {
      console.error("API Error:", error);
    }
  };

  useEffect(() => {
    const unlockUntil = localStorage.getItem("nightLockUntil");
    if (unlockUntil && Date.now() < Number(unlockUntil)) {
      setDisableCheck(true);
      setIsNightLockActive(false);
      return;
    }
    if (disableCheck) return;

    let interval: any;

    const checkTime = async () => {
      try {
        const res = await fetch(
          "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata",
        );
        const data = await res.json();

        const hour = new Date(data.dateTime).getHours();

        setIsNightLockActive(hour >= 20 || hour < 10);
      } catch (err) {
        const hour = new Date().getHours();
        setIsNightLockActive(hour >= 20 || hour < 10);
      }
    };

    checkTime();

    interval = setInterval(checkTime, 60000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [disableCheck]);

  useEffect(() => {
    const unlockUntil = localStorage.getItem("nightLockUntil");

    if (unlockUntil) {
      const now = Date.now();
      const remaining = Number(unlockUntil) - now;

      if (remaining > 0) {
        setIsNightLockActive(false);
        setDisableCheck(true);

        setTimeout(() => {
          setIsNightLockActive(true);
          setDisableCheck(false);
          localStorage.removeItem("nightLockUntil");
        }, remaining);
      } else {
        localStorage.removeItem("nightLockUntil");
        setIsNightLockActive(true);
        setDisableCheck(false);
      }
    }
  }, []);

  const onOtpSubmit = () => {
    const unlockUntil = Date.now() + 1 * 60 * 1000;

    localStorage.setItem("nightLockUntil", unlockUntil.toString());

    setIsNightLockActive(false);
    setDisableCheck(true);

    setTimeout(
      () => {
        setIsNightLockActive(true);
        setDisableCheck(false);
        localStorage.removeItem("nightLockUntil");
      },
      1 * 60 * 1000,
    );
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
              <Breadcrumbs tab={"KYC"} />

              {enlargedImage && (
                <div className="enlarged-image-overlay">
                  <div className="enlarged-image-container">
                    <img src={enlargedImage} alt="Enlarged" />
                  </div>
                  <button
                    className="close-enlarged-image"
                    onClick={closeEnlargedImage}
                  >
                    Close
                  </button>
                </div>
              )}

              <div className="container-fluid">
                <div className="row">
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
                  <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-1">
                    <label className="lbl">Items Per Page</label>
                    <div className="mt-1">
                      <Stateful_Select
                        // label="Select User Type"
                        value={itemsPerPage.toString()}
                        onChange={(newValue: any) => handlePerPage(newValue)}
                        options={["10", "25", "50", "75", "100"]}
                      />
                    </div>
                  </div>
                  <div className="col-6 col-xl-2 col-sm-4 pdrt">
                    <label className="lbl"></label>
                    <a onClick={filterTransaction} className="sechBtn mt-1">
                      Apply
                    </a>
                  </div>
                  <div className="col-6 col-xl-2 col-sm-4 pdrt">
                    <label className="lbl"></label>
                    <a
                      onClick={() => Navigate("/kycList")}
                      className="sechBtn mt-1"
                    >
                      KYC LIST
                    </a>
                  </div>
                  {isNightLockActive && (
                    <div className="col-6 col-xl-2 col-sm-4 pdrt">
                      <label className="lbl"></label>
                      <a
                        onClick={() => setEnableOtpFlow(true)}
                        className="sechBtn mt-1"
                      >
                        Enable KYC Flow
                      </a>
                    </div>
                  )}
                  <div className="col-12 mt-2">
                    <div className="table-responsive">
                      <table className="table table-view">
                        <thead>
                          <tr>
                            <th className="text-center"></th>
                            <th className="text-center">
                              User <br /> ID
                            </th>
                            <th className="text-center">
                              User <br /> Name
                            </th>
                            <th className="text-center">
                              App <br /> Name
                            </th>
                            <th className="text-center">
                              Mobile <br /> Number
                            </th>
                            <th className="text-center">IFSC</th>
                            <th className="text-center">
                              Bank <br /> Account
                            </th>
                            <th className="text-center">
                              Aadhar <br /> No
                            </th>
                            <th className="text-center">UPI ID</th>
                            {/* {User.data.Responsibilities.includes(
                              Responsibilities.Upload_KYC_Cards,
                            ) && (
                              <th className="text-center">
                                Aadhar <br /> card
                              </th>
                            )}
                            {User.data.Responsibilities.includes(
                              Responsibilities.Upload_KYC_Cards,
                            ) && (
                              <th className="text-center">
                                Upload <br /> Image
                              </th>
                            )} */}
                            <th className="text-center">Status</th>
                            <th className="text-center">Date</th>
                            <th className="text-center">Check By</th>
                            <th className="text-center">Cross Check By</th>
                            {(User.data.Responsibilities.includes(
                              Responsibilities.Reject_KYC,
                            ) ||
                              User.data.Responsibilities.includes(
                                Responsibilities.Approve_KYC,
                              )) && <th className="text-center">Reject KYC</th>}
                            <th className="text-center">Check By</th>
                            <th className="text-center">Cross Check By</th>
                            <th>Approve KYC</th>
                            <th className="text-center">Check By</th>
                            <th className="text-center">Cross Check By</th>
                            {(User.data.Responsibilities.includes(
                              Responsibilities.Reject_KYC,
                            ) ||
                              User.data.Responsibilities.includes(
                                Responsibilities.Approve_KYC,
                              )) && <th className="text-center">Manual KYC</th>}
                            <th className="text-center">
                              Manually <br /> Approved By
                            </th>
                          </tr>
                        </thead>
                        <thead>
                          <tr className="bg-table">
                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserId}
                                  onChange={handleSearchUserId}
                                  onSearch={() => filterUser({ force: true })}
                                  placeholder="Search by user id"
                                />
                              </div>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchUserName}
                                  onChange={handleSearchUserName}
                                  onSearch={() => filterUser({ force: true })}
                                  placeholder="Search by user name"
                                />
                              </div>
                            </th>
                            <th className="thdr">
                              <Select
                                labelId="demo-select-small-label"
                                id="demo-select-small"
                                label="Select App Name"
                                value={appClientName}
                                onChange={Handle_App_Client_Name}
                              >
                                {Client_Names?.map(
                                  (appName: any, index: number) => (
                                    <MenuItem key={index} value={appName}>
                                      {appName}
                                    </MenuItem>
                                  ),
                                )}
                              </Select>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchMob}
                                  onChange={handleSearchUserMob}
                                  onSearch={() => filterUser({ force: true })}
                                  placeholder="Search by mobile"
                                />
                              </div>
                            </th>
                            <th className="thdr"></th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchAccNo}
                                  onChange={handleSearchAccNo}
                                  onSearch={() => filterUser({ force: true })}
                                  placeholder="Search by account no"
                                />
                              </div>
                            </th>
                            <th className="thdr">
                              <div className="d-flex justify-content-center">
                                <SearchBar
                                  value={searchAadharNo}
                                  onChange={handleSearchAadharNo}
                                  onSearch={() => filterUser({ force: true })}
                                  placeholder="Search by account no"
                                />
                              </div>
                            </th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            {/* <th className="thdr"></th>
                            <th className="thdr"></th> */}
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                            <th className="thdr"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((item: any, Index) => {
                            let {
                              _id: id,
                              name,
                              mobile,
                              clientName,
                              aadhaarNumber,
                              ifsc,
                              manualKycUpdatedBy,
                              accountNumber,
                              aadhaarImageBase64: image,
                              kyc,
                              upiId,
                              createdOn: date,
                            } = item;
                            return (
                              <>
                                <tr>
                                  <td>
                                    {Index +
                                      1 +
                                      (currentPage && itemsPerPage
                                        ? (currentPage - 1) * itemsPerPage
                                        : 0)}
                                  </td>
                                  <td>
                                    {id}
                                    <ContentCopyIcon
                                      onClick={() => copyMobile(id)}
                                      style={{
                                        color: "#333",
                                        fontSize: "17px",
                                        marginLeft: "10px",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </td>
                                  <td
                                    style={{ cursor: "pointer" }}
                                    key={id}
                                    onClick={() => {
                                      const url = `/user-report/${id}/${name}`;
                                      window.open(url, "_blank");
                                    }}
                                  >
                                    {name}
                                  </td>
                                  <td>{clientName}</td>
                                  <td>
                                    {/* {User?.data?.Responsibilities?.includes(
                                      Responsibilities?.show_mobile,
                                    ) ? ( */}
                                    <>
                                      {/* {item?.mobile}{" "}
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
                                        /> */}
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                        }}
                                      >
                                        {"**********"}
                                        {!isNightLockActive && (
                                          <Button
                                            onClick={() =>
                                              connectToDialer(item)
                                            }
                                            className="btn-popup"
                                            disabled={isNightLockActive}
                                            variant="contained"
                                            style={{
                                              marginLeft: 10,
                                              color: "#000",
                                              backgroundColor: "orange",
                                            }}
                                          >
                                            Call
                                          </Button>
                                        )}
                                      </div>
                                    </>
                                    {/* ) : (
                                      "-"
                                    )} */}
                                  </td>
                                  <td>
                                    {
                                      <TextField
                                        className="mt-2 text-kyc"
                                        type="text"
                                        fullWidth
                                        sx={{ width: { xs: 120, md: 250 } }}
                                        variant="outlined"
                                        label="IFSC"
                                        size="small"
                                        value={IFSCs[Index]}
                                        onChange={(Event) =>
                                          Change_IFSC(Event.target.value, Index)
                                        }
                                        InputLabelProps={{
                                          style: {
                                            fontFamily: "Roboto",
                                            fontSize: "14px",
                                          },
                                        }}
                                      />
                                    }
                                  </td>
                                  <td>
                                    {
                                      <TextField
                                        className="mt-2 text-kyc"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        label="Bank Account"
                                        size="small"
                                        sx={{ width: { xs: 120, md: 150 } }}
                                        value={Bank_Accounts[Index]}
                                        onChange={(Event) =>
                                          Change_Bank_Account(
                                            Event.target.value,
                                            Index,
                                          )
                                        }
                                        InputLabelProps={{
                                          style: {
                                            fontFamily: "Roboto",
                                            fontSize: "14px",
                                          },
                                        }}
                                      />
                                    }
                                  </td>
                                  <td>
                                    <div className="d-flex justify-content-between align-items-center">
                                      {/* <span>{aadhaarNumber ?? "-"}</span>

                                      {!aadhaarNumber && !isNightLockActive && (
                                        <FontAwesomeIcon
                                          id={item._id}
                                          className="fa fa-pencil-square icon-home icon-trash"
                                          icon={faPencilSquare}
                                          onClick={() => {
                                            setShowUPIIDModal(true);
                                            setIskYCModal(true);
                                            setSelectUserId(item?._id);
                                          }}
                                          style={{
                                            cursor: "pointer",
                                            color: "black",
                                          }}
                                        />
                                      )} */}
                                      {
                                        <TextField
                                          className="mt-2 text-kyc"
                                          type="text"
                                          fullWidth
                                          variant="outlined"
                                          label="Aadhar Number"
                                          size="small"
                                          sx={{ width: { xs: 120, md: 150 } }}
                                          value={Aadhar_Number[Index]}
                                          onChange={(Event) =>
                                            Change_Aadhar_Number(
                                              Event.target.value,
                                              Index,
                                            )
                                          }
                                          InputLabelProps={{
                                            style: {
                                              fontFamily: "Roboto",
                                              fontSize: "14px",
                                            },
                                          }}
                                        />
                                      }
                                    </div>
                                  </td>
                                  <td>
                                    <div className="d-flex justify-content-between align-items-center">
                                      {/* <span>{upiId || "-"}</span>

                                      {!isNightLockActive && (
                                        <FontAwesomeIcon
                                          id={item._id}
                                          className="fa fa-pencil-square icon-home icon-trash"
                                          icon={faPencilSquare}
                                          onClick={() => {
                                            setShowUPIIDModal(true);
                                            setSelectUserId(item?._id);
                                          }}
                                          style={{
                                            cursor: "pointer",
                                            color: "black",
                                          }}
                                        />
                                      )} */}
                                      <TextField
                                        className="mt-2 text-kyc"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        label="Upi ID"
                                        size="small"
                                        sx={{ width: { xs: 120, md: 150 } }}
                                        value={UPIId[Index]}
                                        onChange={(Event) =>
                                          Change_UpiID(
                                            Event.target.value,
                                            Index,
                                          )
                                        }
                                        InputLabelProps={{
                                          style: {
                                            fontFamily: "Roboto",
                                            fontSize: "14px",
                                          },
                                        }}
                                      />
                                    </div>
                                  </td>
                                  {/* {User.data.Responsibilities.includes(
                                    Responsibilities.Upload_KYC_Cards,
                                  ) &&
                                    (Files[Index] ? (
                                      <td
                                        className="td-card"
                                        onClick={() =>
                                          handleImageClick(Files[Index])
                                        }
                                      >
                                        View Aadhar Card
                                      </td>
                                    ) : (
                                      <td>Aadhar card is not uploaded</td>
                                    ))}

                                  {User.data.Responsibilities.includes(
                                    Responsibilities.Upload_KYC_Cards,
                                  ) && (
                                    <td>
                                      <div id={Index.toString()}>
                                        <input
                                          accept="image/png, image/jpeg, image/jpg"
                                          style={{ display: "none" }}
                                          id={`outlined-none-${Index}`}
                                          onChange={(Event) =>
                                            handleFileChange(Event, Index)
                                          }
                                          type="file"
                                        />
                                        <label
                                          htmlFor={`outlined-none-${Index}`}
                                          style={{
                                            fontFamily: "Roboto",
                                            fontSize: "14px",
                                            margin: "0",
                                          }}
                                        >
                                          <Button
                                            variant="contained"
                                            component="span"
                                            className="upload-btn"
                                          >
                                            Upload
                                          </Button>
                                        </label>
                                      </div>
                                    </td>
                                  )} */}

                                  <td>
                                    {KYCs[Index] ? "Approved" : "Rejected"}
                                  </td>
                                  <td>{formatDate(date)}</td>
                                  <td>
                                    {kyc === true &&
                                      !item?.kycRejectCheckBy &&
                                      !item?.kycRejectCrossCheckBy &&
                                      btnClickID === id && (
                                        <span
                                          onClick={() =>
                                            checkedBy(id, "first", true)
                                          }
                                        >
                                          <FontAwesomeIcon
                                            className="fa fa-pencil-square icon-home icon-banner checkd"
                                            icon={faSquareCheck}
                                          />
                                        </span>
                                      )}
                                    {item?.kycRejectCheckBy && (
                                      <span>
                                        <strong> Checked by</strong>
                                        {` : ${item?.kycRejectCheckBy?.name}`}
                                        <br />
                                        <strong>Date Time</strong>
                                        {`: ${formatDate(
                                          item?.kycRejectCheckBy?.date,
                                        )} ${formatedTime(
                                          item?.kycRejectCheckBy?.date,
                                        )}`}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {item?.kycRejectCheckBy &&
                                      !item.kycRejectCrossCheckBy &&
                                      !isNightLockActive && (
                                        <span
                                          onClick={() =>
                                            checkedBy(id, "second", true)
                                          }
                                        >
                                          <FontAwesomeIcon
                                            className="fa fa-pencil-square icon-home icon-banner checkd"
                                            icon={faSquareCheck}
                                          />
                                        </span>
                                      )}
                                    {item?.kycRejectCheckBy &&
                                      item.kycRejectCrossCheckBy && (
                                        <span>
                                          <strong>Cross Checked by</strong>
                                          {` : ${item?.kycRejectCrossCheckBy?.name}`}
                                          <br />
                                          <strong>Date Time</strong>
                                          {`: ${formatDate(
                                            item.kycRejectCrossCheckBy?.date,
                                          )} ${formatedTime(
                                            item.kycRejectCrossCheckBy?.date,
                                          )}`}
                                        </span>
                                      )}
                                  </td>
                                  <td>
                                    {
                                      <Button
                                        className={`withdraw-btn ${
                                          kyc &&
                                          item?.kycRejectCheckBy &&
                                          item?.kycRejectCrossCheckBy &&
                                          !isNightLockActive
                                            ? ""
                                            : "disabled_"
                                        }`}
                                        variant="contained"
                                        onClick={() =>
                                          sendKYCOtp(mobile, clientName, item)
                                        }
                                        disabled={
                                          !(
                                            kyc &&
                                            item?.kycRejectCheckBy &&
                                            item?.kycRejectCrossCheckBy
                                          )
                                        }
                                      >
                                        Reject KYC with OTP
                                      </Button>
                                    }
                                  </td>

                                  <td>
                                    {!item?.kycDocCheckBy &&
                                      !item?.kycDocCrossCheckBy &&
                                      btnClickID === id &&
                                      !isNightLockActive && (
                                        <span
                                          onClick={() =>
                                            checkBeforUploadDoc(
                                              id,
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
                                      )}
                                    {item?.kycDocCheckBy && (
                                      <span>
                                        <strong> Checked by</strong>
                                        {` : ${item?.kycDocCheckBy?.name}`}
                                        <br />
                                        <strong>Date Time</strong>
                                        {`: ${formatDate(
                                          item?.kycDocCheckBy?.date,
                                        )} ${formatedTime(
                                          item?.kycDocCheckBy?.date,
                                        )}`}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {item?.kycDocCheckBy &&
                                      !item.kycDocCrossCheckBy && (
                                        <span
                                          onClick={() =>
                                            checkBeforUploadDoc(
                                              id,
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
                                      )}
                                    {item?.kycDocCheckBy &&
                                      item.kycDocCrossCheckBy && (
                                        <span>
                                          <strong>Cross Checked by</strong>
                                          {` : ${item?.kycDocCrossCheckBy?.name}`}
                                          <br />
                                          <strong>Date Time</strong>
                                          {`: ${formatDate(
                                            item.kycDocCrossCheckBy?.date,
                                          )} ${formatedTime(
                                            item.kycDocCrossCheckBy?.date,
                                          )}`}
                                        </span>
                                      )}
                                  </td>
                                  <td>
                                    {User.data.Responsibilities.includes(
                                      Responsibilities.Approve_KYC,
                                    ) && (
                                      <span className="ms-1">
                                        <Button
                                          className={`withdraw-btn ${
                                            item?.kycDocCheckBy &&
                                            item?.kycDocCrossCheckBy &&
                                            !isNightLockActive
                                              ? ""
                                              : "disabled_"
                                          }`}
                                          variant="contained"
                                          disabled={
                                            !(
                                              item?.kycDocCheckBy &&
                                              item?.kycDocCrossCheckBy &&
                                              !isNightLockActive
                                            )
                                          }
                                          // onClick={() => openApproveKYCOTPModal(id)}
                                          onClick={() =>
                                            handleOpenApproveKYCOTPModal({
                                              index: Index,
                                              ...item,
                                            })
                                          }
                                        >
                                          Approve
                                        </Button>
                                      </span>
                                    )}
                                  </td>

                                  <td>
                                    {!item?.kycManualCheckBy &&
                                      !item?.kycManualCrossCheckBy &&
                                      btnClickID === id &&
                                      !isNightLockActive && (
                                        <span
                                          onClick={() =>
                                            checkBeforManualKyc(
                                              id,
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
                                      )}
                                    {item?.kycManualCheckBy && (
                                      <span>
                                        <strong> Checked by</strong>
                                        {` : ${item?.kycManualCheckBy?.name}`}
                                        <br />
                                        <strong>Date Time</strong>
                                        {`: ${formatDate(
                                          item?.kycManualCheckBy?.date,
                                        )} ${formatedTime(
                                          item?.kycManualCheckBy?.date,
                                        )}`}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {item?.kycManualCheckBy &&
                                      !item.kycManualCrossCheckBy && (
                                        <span
                                          onClick={() =>
                                            checkBeforManualKyc(
                                              id,
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
                                      )}
                                    {item?.kycManualCheckBy &&
                                      item.kycManualCrossCheckBy && (
                                        <span>
                                          <strong>Cross Checked by</strong>
                                          {` : ${item?.kycManualCrossCheckBy?.name}`}
                                          <br />
                                          <strong>Date Time</strong>
                                          {`: ${formatDate(
                                            item.kycManualCrossCheckBy?.date,
                                          )} ${formatedTime(
                                            item.kycManualCrossCheckBy?.date,
                                          )}`}
                                        </span>
                                      )}
                                  </td>
                                  <td>
                                    {item?.kycManualCheckBy &&
                                      item?.kycManualCrossCheckBy &&
                                      !isNightLockActive && (
                                        <Button
                                          className={`withdraw-btn ${
                                            !(
                                              item?.kycManualCheckBy &&
                                              item?.kycManualCrossCheckBy
                                            )
                                              ? "disabled"
                                              : ""
                                          }`}
                                          variant="contained"
                                          disabled={
                                            !(
                                              item?.kycManualCheckBy &&
                                              item?.kycManualCrossCheckBy &&
                                              !isNightLockActive
                                            )
                                          }
                                          // onClick={() => openManualPopup(id)}
                                          onClick={() =>
                                            sendManualKycOTP(
                                              mobile,
                                              clientName,
                                              item,
                                            )
                                          }
                                        >
                                          Manual Approve OTP
                                        </Button>
                                      )}
                                  </td>
                                  <td>
                                    {manualKycUpdatedBy && (
                                      <span>
                                        {`Manual Approved by ${
                                          manualKycUpdatedBy?.name ?? ""
                                        }`}{" "}
                                        <br />
                                        {`${formatDateManual(
                                          manualKycUpdatedBy?.date,
                                        )} | ${formatedTime(
                                          manualKycUpdatedBy?.date,
                                        )}`}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              </>
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
                          onChange={(Event, New_Page) =>
                            setCurrentPage(New_Page)
                          }
                        />
                      </Stack>
                    </ul>
                  </div>
                </div>

                <footer className="footer">
                  <div className="container-fluid">
                    <div className="row align-items-center justify-content-lg-between">
                      <div className="col-lg-6 mb-lg-0  ">
                        <div className="copyright text-center text-sm text-muted text-lg-start">
                          © osgames.co
                        </div>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
            </div>
          </main>
        </div>
      )}

      <div>
        <Dialog open={openPopup} onClose={() => setOpenPopup(false)}>
          <DialogContent>
            <form onSubmit={manualApproveSubmit}>
              <div className="parent-container">
                <div className="centered-div">
                  <div className="mt-1 text-inp">
                    <label>Customer OTP</label>
                    <TextField
                      onChange={handleOTPInput}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={inputOTP}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-1 text-inp">
                    <label>Admin OTP</label>
                    <TextField
                      onChange={(e: any) => setAdminOTP(e?.target?.value)}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={adminOtp}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-1 text-inp">
                    <label>User Bank Name</label>
                    <TextField
                      onChange={handleManualUserBankName}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={manualUserBankName}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-2 text-inp">
                    <label>Bank Name</label>
                    <TextField
                      onChange={handleManualBankName}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={manualBankName}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-2 text-inp">
                    <label>User Account No</label>
                    <TextField
                      onChange={handleManualUserAccNo}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={manualUserAccNo}
                      type={"number"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-2 text-inp">
                    <label>User Aadhar No</label>
                    <TextField
                      onChange={handleManualUserAadhar}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={manualUserAadhar}
                      type={"number"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-2 text-inp">
                    <label>User UPI ID</label>
                    <TextField
                      onChange={(e) => setUserUPIID(e?.target?.value)}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={userUPIID}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-2 text-inp">
                    <label>User IFSC</label>
                    <TextField
                      onChange={handleManualUserIfsc}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={manualUserIfsc}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-2 text-inp">
                    <label>Comment (For KYC Updation)</label>
                    <TextField
                      onChange={(e: any) => setComment(e?.target?.value)}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={comment}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                </div>
              </div>
              <DialogActions className="mt-2">
                <Button
                  className="btn-popup"
                  variant="outlined"
                  onClick={closeManualPopup}
                  color="primary"
                >
                  Close
                </Button>
                <Button className="btn-popup" variant="outlined" type="submit">
                  Submit
                </Button>
              </DialogActions>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <Dialog open={showOTPModal} onClose={() => setShowOTPModal(false)}>
          <DialogContent>
            <form onSubmit={handleOTPSubmit}>
              <div className="parent-container">
                <div className="centered-div">
                  <div className="mt-1 text-inp">
                    <label>Enter Customer OTP</label>
                    <TextField
                      required
                      onChange={handleOTPInput}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={inputOTP}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-1 text-inp">
                    <label>Admin OTP</label>
                    <TextField
                      required
                      onChange={(e: any) => setAdminOTP(e?.target?.value)}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={adminOtp}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                </div>
              </div>
              <DialogActions className="mt-2">
                <Button
                  className="btn-popup"
                  variant="outlined"
                  onClick={() => {
                    setShowOTPModal(false);
                    setInputOTP("");
                    setAdminOTP("");
                  }}
                  color="primary"
                >
                  Close
                </Button>
                <Button className="btn-popup" variant="outlined" type="submit">
                  Reject
                </Button>
              </DialogActions>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* <div>
        <Dialog open={showDocOTPModal} onClose={() => setShowDocOTPModal(false)}>
          <DialogContent>
            <form>
              <div className='parent-container'>
                <div className='centered-div'>
                  <div className='mt-1 text-inp'>
                    <label>Enter OTP</label>
                    <TextField required onChange={handleOTPInput} variant="outlined" size="small" className="mt-2" value={inputOTP} type={"text"} fullWidth={true} />
                  </div>
                </div>
              </div>
              <DialogActions className='mt-2'>
                <Button
                  onClick={() => {
                    setShowDocOTPModal(false);
                    setInputOTP("")
                  }}
                  variant="contained"
                  component="span"
                  className="upload-btn"
                >
                  Close
                </Button>
                <div>
                  <input
                    accept="image/png, image/jpeg, image/jpg"
                    style={{ display: 'none' }}
                    id={`outlined-none`}
                    onChange={(Event) => handleFileChange(Event, uploadDocItemIndex)}
                    type="file"
                  />
                  <label htmlFor={`outlined-none`} style={{ fontFamily: "Roboto", fontSize: "14px", margin: "0" }}>
                    <Button variant="contained" component="span" className="upload-btn">
                      Upload
                    </Button>
                  </label>
                </div>
              </DialogActions>
            </form>
          </DialogContent>
        </Dialog>
      </div> */}

      {/* <div>
        <Dialog open={showManualKycOTPModal} onClose={() => setShowManualKycOTPModal(false)}>
          <DialogContent>
            <form onSubmit={handleManualKYCOtpSubmit}>
              <div className='parent-container'>
                <div className='centered-div'>
                  <div className='mt-1 text-inp'>
                    <label>Enter OTP</label>
                    <TextField required onChange={handleOTPInput} variant="outlined" size="small" className="mt-2" value={inputOTP} type={"text"} fullWidth={true} />
                  </div>
                </div>
              </div>
              <DialogActions className='mt-2'>
                <Button
                  className="btn-popup"
                  variant="outlined"
                  onClick={() => {
                    setShowManualKycOTPModal(false);
                    setInputOTP("")
                  }}
                  color="primary"
                >
                  Close
                </Button>
                <Button
                  className="btn-popup"
                  variant="outlined"
                  type="submit"
                >
                  Reject
                </Button>
              </DialogActions>
            </form>
          </DialogContent>
        </Dialog>
      </div> */}

      <div>
        <Dialog
          open={showAppoveOTPModal}
          onClose={() => setShowApproveOTPModal(false)}
        >
          <DialogContent>
            <form onSubmit={approveKYC}>
              <div className="parent-container">
                <div className="centered-div">
                  <div className="mt-1 text-inp">
                    <label>Enter Customer OTP</label>
                    <TextField
                      required
                      onChange={handleOTPInput}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={inputOTP}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-1 text-inp">
                    <label>Admin OTP</label>
                    <TextField
                      required
                      onChange={(e: any) => setAdminOTP(e?.target?.value)}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={adminOtp}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                  <div className="mt-1 text-inp">
                    <label>Comment (For KYC Updation)</label>
                    <TextField
                      required
                      onChange={(e: any) => setComment(e?.target?.value)}
                      variant="outlined"
                      size="small"
                      className="mt-2"
                      value={comment}
                      type={"text"}
                      fullWidth={true}
                    />
                  </div>
                </div>
              </div>
              <DialogActions className="mt-2">
                <Button
                  className="btn-popup"
                  variant="outlined"
                  onClick={() => {
                    setShowApproveOTPModal(false);
                    setInputOTP("");
                    setAdminOTP("");
                  }}
                  color="primary"
                >
                  Close
                </Button>
                <Button className="btn-popup" variant="outlined" type="submit">
                  Approve
                </Button>
              </DialogActions>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div>
        <Dialog open={showUPIIDModal} onClose={() => setShowUPIIDModal(false)}>
          <DialogContent>
            <div className="parent-container">
              <div className="centered-div">
                <div className="mt-1 text-inp">
                  <label>
                    {isKycModal ? "Enter Adhar Number" : "Enter UPI ID"}
                  </label>
                  <TextField
                    required
                    onChange={handleUserUPIInput}
                    variant="outlined"
                    size="small"
                    className="mt-2"
                    value={userUpiId}
                    type={"text"}
                    fullWidth={true}
                  />
                </div>
              </div>
            </div>
            <DialogActions className="mt-2">
              <Button
                className="btn-popup"
                variant="outlined"
                onClick={() => {
                  setShowUPIIDModal(false);
                  setIskYCModal(false);
                  setUserUpiId("");
                }}
                color="primary"
              >
                Close
              </Button>
              <Button
                className="btn-popup"
                variant="outlined"
                onClick={() => updateUserUPIID()}
              >
                Approve
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>
      </div>
      <OtpModal
        isOpen={enableOtpFlow}
        onClose={() => setEnableOtpFlow(false)}
        onOtpSubmit={() => onOtpSubmit()}
        locationInfo={locationInfo}
        address={address}
        userData={User}
      />
    </>
  );
}

export default Userkyc;
