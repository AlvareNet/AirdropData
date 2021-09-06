"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const google_spreadsheet_1 = require("google-spreadsheet");
const merkletreejs_1 = require("merkletreejs");
const js_sha3_1 = require("js-sha3");
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const creds = __importStar(require("../sheet_secret.json"));
const sheetconfig = __importStar(require("../sheet_config.json"));
const chunkfilename = "chunk";
const mappingfilename = "mappings";
const contractsettings = "settings";
const fileending = ".json";
const path = "./output/slothi/";
const chunksize = 100;
function sortData(a, b) {
    if (a.address < b.address) {
        return -1;
    }
    if (a.address > b.address) {
        return 1;
    }
    return 0;
}
function getData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const doc = new google_spreadsheet_1.GoogleSpreadsheet(sheetconfig.sheet);
            yield doc.useServiceAccountAuth(creds);
            yield doc.loadInfo();
            var sheet = doc.sheetsByIndex[0];
            var entries = sheet.rowCount;
            console.log("Loaded: " + sheet.title + " with " + entries + " rows");
            console.log("Getting rows");
            var rows = yield sheet.getRows();
            var rows2 = [];
            rows.forEach((row) => {
                if (row.HolderAddress.length > 0 && row.HolderAddress != "" && !row.Finalbalance.includes("-") && row.Finalbalance != "0" && row.Finalbalance.length > 0) {
                    rows2.push({ address: row.HolderAddress, amount: row.Finalbalance });
                }
            });
            return rows2;
        }
        catch (error) {
            console.log(error);
        }
        return [];
    });
}
function GenerateProofs() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            var data = yield getData();
            data.sort(sortData);
            var leaves = [];
            data.forEach((row, pos) => {
                leaves.push(Buffer.from(ethers_1.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [pos, row.address, ethers_1.utils.parseUnits(row.amount, 9)]).substr(2), 'hex'));
            });
            const tree = new merkletreejs_1.MerkleTree(leaves, js_sha3_1.keccak_256);
            const root = tree.getHexRoot();
            var index = 0;
            var filecounter = 0;
            var total = ethers_1.BigNumber.from("0");
            var mappingobject = [];
            while (index < data.length) {
                var tmpcounter = 0;
                var startaddress = data[index].address;
                var tmpobject = {};
                while (tmpcounter < chunksize && (tmpcounter + index) < data.length) {
                    var pos = index + tmpcounter;
                    var tmpamount = ethers_1.utils.parseUnits(data[pos].amount, 9);
                    total = total.add(tmpamount);
                    tmpobject[data[pos].address] = { index: pos, amount: tmpamount.toHexString(), proof: tree.getHexProof(leaves[pos]) };
                    tmpcounter++;
                }
                index += tmpcounter;
                mappingobject[filecounter] = { start: startaddress, stop: data[index - 1].address, file: chunkfilename + filecounter.toString() + fileending };
                try {
                    fs.writeFileSync(path + chunkfilename + filecounter.toString() + fileending, JSON.stringify(tmpobject));
                }
                catch (error) {
                    console.log(error);
                }
                filecounter++;
            }
            var contractvariables = { merkleroot: root, total: total.toString() };
            try {
                fs.writeFileSync(path + mappingfilename + fileending, JSON.stringify(mappingobject));
                fs.writeFileSync(path + contractsettings + fileending, JSON.stringify(contractvariables));
            }
            catch (error) {
                console.log(error);
            }
            console.log("Wrote " + (filecounter - 1).toString() + " chunks");
        }
        catch (error) {
            console.log(error);
        }
    });
}
GenerateProofs().then();
