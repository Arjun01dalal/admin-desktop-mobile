import React, { FormEvent, useEffect, useState } from "react";
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    OutlinedInput,
    Select,
    TextField,
} from "@mui/material";
import axios from "axios";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";
import { toast } from "react-toastify";
import { decryptData } from "../../../../utils/decryptData";

const CustomInputField = ({ item, getData, id }: any) => {
    const [nameList, setNameList] = useState<string[]>([]);
    const [name, setName] = useState<string>("");

    useEffect(() => {
        if (Array.isArray(item.oldMultipleNames)) {
            setNameList(item.oldMultipleNames);
        } else {
            setNameList([]);
        }
    }, [item?.oldMultipleNames]);

    // ✅ Add new city to list
    const handleUpdateUserName = (e: any) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const isDuplicate = nameList.some(
            (list) => list?.toLowerCase() === trimmed.toLowerCase()
        );
        if (isDuplicate) {
            toast.warn(`"${trimmed}" already exists in the list!`);
            return;
        }
        updateUserName(e, trimmed, id)
        setName("");

    };


    const updateUserName = (e: FormEvent, name: string, id: string) => {
        e.preventDefault();
        const token = localStorage.getItem("token");
        const data = {
            userId: item?.userId,
            name: name,
            transactionId: item?.orderId
        };
        console.log("data::", data);

        axios
            .post(
                `${API_Endpoint}/User/updateUserOldName`,
                { token: encryptData(data) },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )
            .then((res: any) => {
                console.log("res:::", decryptData(res?.data?.data));
                toast("Secondary User Name Added successfully!");
                getData();
            })
            .catch((err) => {
            });
    };

    return (
        <FormControl sx={{ m: 1, width: 300 }}>
            <InputLabel id={`city-select-label-${item._id}`}>User Name List</InputLabel>
            <Select
                labelId={`city-select-label-${item._id}`}
                id={`city-select-${item._id}`}
                multiple
                value={Array.isArray(item.oldMultipleNames) ? item.oldMultipleNames : []}
                input={<OutlinedInput label="Secondary User Name" />}
                MenuProps={{
                    PaperProps: {
                        style: {
                            maxHeight: 320,
                            width: 260,
                        },
                    },
                    disableAutoFocusItem: true,
                }}
            >
                {nameList.map((item) => (
                    <MenuItem key={item} value={item}>
                        {item}
                    </MenuItem>
                ))}
            </Select>
            {
                item?.status === "Pending" &&

                <Box
                    sx={{
                        mt: 1,
                        pt: 1,
                        px: 2,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                    }}
                >
                    <TextField
                        size="small"
                        label="Secondary User Name"
                        variant="outlined"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={(e) => handleUpdateUserName(e)}
                        disabled={!name.trim()}
                    >
                        Add
                    </Button>
                </Box>
            }
        </FormControl>
    );
};

export default CustomInputField;
