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
            rows.forEach((row, index) => {
                if (row.HolderAddress && row.HolderAddress.length > 0 && row.HolderAddress != "" && row.Finalbalance && row.Finalbalance.length > 0 && !row.Finalbalance.includes("-") && row.Finalbalance != "0") {
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
                leaves.push(Buffer.from(ethers_1.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [pos, row.address, ethers_1.utils.parseUnits(row.amount, 9).toHexString()]).substr(2), 'hex'));
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
            console.log("Testing proofs");
            var test = { data: [10000, "0xfda1666ff451eef866b3dd6b4d904a391ed91f2a", "0x238c6c609afe80"], "proof": ["0xf4be6bd8bc81c9c6c155e0eab7d4355c7b6c9d03c24a67c7f9166d42c75636a6", "0x9ab412a02fec01569c3430c665a0615c69cf6af34642158f2a6a9b068e058e06", "0xb4d2b2f908d84923ef5f18c1bec7a96b892f5106bcb29a5865936812778f2bbf", "0xab7ecb0d7cd314a135f618f2807f1624ce16e5704693ce8844e530dc719cc96e", "0xd4d210d945f0be022615c55784949b92b4bbd04898d542bd94e2ce41774374ca", "0xb0e93bc159e8b5bde3880ec185978b0494c1fe9d95167ea4dd636a85010d9537", "0xa28d9d83f249ffc175fdd407d1af75a1578f911482743bca933d5a002f750f2b", "0xe22fa97c388abf743ea60fac7f408b6fc9c1e9d5e8a4e7f4c80967bf31c33027", "0xdae616e89370dac59bb7f811cd60b72cd756869809291a6ed36bc57097537b00", "0xc2b81458ab3e7565426f49252b8fe95e6f7f8135d8a7df58e074d457ec566e4a", "0x0c9dab9def3d3045183f369384cf0ee1291dbb361d749f5d568adf6ba7f77911"] };
            var testleave = Buffer.from(ethers_1.utils.solidityKeccak256(['uint256', 'address', 'uint256'], test.data).substr(2), 'hex');
            console.log(tree.verify(test.proof, testleave, root));
        }
        catch (error) {
            console.log(error);
        }
    });
}
GenerateProofs().then();
