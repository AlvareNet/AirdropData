import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { MerkleTree } from "merkletreejs";
import { keccak_256 } from 'js-sha3';
import { BigNumber, utils } from "ethers";
import * as fs from 'fs'
import { Console } from "console";

import * as creds from '../sheet_secret.json';
import * as sheetconfig from '../sheet_config.json';
const chunkfilename = "chunk";
const mappingfilename = "mappings"
const contractsettings = "settings"
const fileending = ".json";
const path = "./output/"
const chunksize = 50
const slth = "0x5B9dbeBbad94b8C6467Af9e8A851Bb120F9601c6"
const sama = "0xb255cddf7fbaf1cbcc57d16fe2eaffffdbf5a8be"

function mapSheet(rows: GoogleSpreadsheetRow[], 
    dataobject :{ [address: string]: {contract: string; amount: string;}[] }, 
    contract: string, adresses: string[] ): 
    [{ [address: string]: {contract: string; amount: string;}[] }, string[]]{

    rows.forEach((row) => {
        if(row.HolderAddress && row.HolderAddress.length > 0 && row.HolderAddress != "" && row.FinalBalance && row.FinalBalance.length > 0 && !row.FinalBalance.includes("-") && row.FinalBalance != "0"){
            if(!dataobject[row.HolderAddress]){
                dataobject[row.HolderAddress] = []
                adresses.push(row.HolderAddress)
            }
            dataobject[row.HolderAddress].push({contract: contract, amount: row.FinalBalance})
        }
    });
    return [dataobject, adresses]
}

async function getData(): Promise< [{ [address: string]: {contract: string; amount: string;}[] }, string[]]> {
    try{
        const doc = new GoogleSpreadsheet(sheetconfig.sheet);
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo(); 
        var slothisheet = doc.sheetsByIndex[0];
        var samarisheet = doc.sheetsByIndex[1];
        var slthentries = slothisheet.rowCount;
        var samaentries = samarisheet.rowCount;
        var adresses: string[] = [];
        console.log("Loaded: " + slothisheet.title + " with " + slthentries + " rows");
        console.log("Getting rows");
        var slthirows = await slothisheet.getRows();
        var data: { [address: string]: {contract: string; amount: string;}[] } = {};
        [data, adresses] = mapSheet(slthirows, data, slth, adresses)
        console.log("Loaded: " + samarisheet.title + " with " + samaentries + " rows");
        console.log("Getting rows");
        var samarows = await samarisheet.getRows();
        [data, adresses] = mapSheet(samarows, data, sama, adresses);
        console.log(adresses.length)
        console.log(data[adresses[1]])
        return [data, adresses];
    }
    catch(error){
        console.log(error)
    }
    return [{}, []]
}

async function GenerateProofs(){
    try{
        var [data, adresses] = await getData()
        adresses.sort()
        var leaves = <Buffer[]>[];
        var counter = 0;
        var slthtotal = BigNumber.from("0");
        var samatotal = BigNumber.from("0");
        var finaldata : { [address: string]: {index: number; contract: string; amount: string; proof: string[]}[] } = {}
        adresses.forEach((address) => {
            data[address].forEach((entry) =>{
                var amount = utils.parseUnits(entry.amount, 9);
                leaves.push(Buffer.from(utils.solidityKeccak256(['uint256', 'address', 'uint256', 'address'], [counter, address, amount.toHexString(), entry.contract]).substr(2),'hex'));
                if(!finaldata[address]){
                    finaldata[address] = []
                }
                finaldata[address].push({index: counter, amount: amount.toHexString(), contract: entry.contract, proof: []})
                if(entry.contract == slth){
                    slthtotal = slthtotal.add(amount)
                }
                else if(entry.contract == sama){
                    samatotal = samatotal.add(amount)
                }
                else{
                    throw "Error in contract variable!"
                }
                counter++
            })
        })
        const tree = new MerkleTree(leaves, keccak_256, {sortPairs: true});
        const root = tree.getHexRoot();
        var index = 0;
        var filecounter = 0;
        var mappingobject = <{start: string, stop: string, file: string}[]>[]
        while(index < adresses.length){
            var tmpcounter = 0;
            var startaddress = adresses[index]
            var chunk: { [key: string]: {index: number, contract: string; amount: string, proof: string[]}[]} = {}
            while(tmpcounter < chunksize && (tmpcounter + index) < adresses.length){
                var pos = index + tmpcounter;
                chunk[adresses[pos]] = finaldata[adresses[pos]].map((entry) => {
                    return {index: entry.index, contract: entry.contract, amount: entry.amount, proof: tree.getHexProof(leaves[entry.index], entry.index)}
                })
                tmpcounter++;
            }
            index += tmpcounter;
            mappingobject[filecounter] = {start: startaddress, stop: adresses[index-1], file: chunkfilename + filecounter.toString() + fileending}
            try {
                fs.writeFileSync(path +  chunkfilename + filecounter.toString() + fileending, JSON.stringify(chunk))
            } catch (error) {
                console.log(error)
            }
            filecounter++;
        }
        var contractvariables = { merkleroot: root, slthtotal: slthtotal.toString(), samatotal: samatotal.toString()}
        try {
            fs.writeFileSync(path +  mappingfilename + fileending, JSON.stringify(mappingobject))
            fs.writeFileSync(path +  contractsettings + fileending, JSON.stringify(contractvariables))
        } catch (error) {
            console.log(error)
        }
        console.log("Wrote " + (filecounter-1).toString() + " chunks")
        console.log("Testing proof")
        var test = {data: [10829, "0xfcad391c2e5b3e5d8096c06bf25c3331d3dbfde0", "0x128b8ff5ba4000", "0x5B9dbeBbad94b8C6467Af9e8A851Bb120F9601c6"], "proof":["0x89fac7abafb673f58408d6d50cb0419ed095b3cf2128cf34c91b991519416cd5","0x373e8d640c39d2a69de0106351cb80f55465ba3463ef5d6b8abaccb869af5815","0xe91524b1d8639f0cb945c58b4e0edc8797ff2a22f7096ce1a3f9ee3d8c250d1d","0x67dceba0ee484c6c60d551a2d794d1de2a02dfa925970bde8fa67db8a054cd4d","0xcab7e1ce6ab4bf8c38f41bfbf1a33df13bab7a3aa48e35f3718cbfa1916a9915","0x1c777d47b24443393e1a7d3bed22eda959981c27feb7eed69443c95f921ba650","0xe78c9ad1c98158cae9f011205fe283e3b706c693ca12fb3c95684fdd22418f8f","0x6996521147ac14e55ffcf12c095932b69e0ec1e7cf1b6316fedc67cc5536688a","0x691fd3564f91f9e9eb25fc2706578f9418fe51b620bce31c00bea525c221a39c","0x1e221adb0620fbab6b6644679e03d537b3384975055e25a2d8dc5925e45c65d1","0xd7caa5425031092289b63c5affa48ae54ef5606c0141fee65b73d2f23a4b9a6a"]}
        var testleave = Buffer.from(utils.solidityKeccak256(['uint256', 'address', 'uint256', 'address'], test.data).substring(2),'hex')
        console.log(tree.verify(tree.getHexProof(testleave), testleave, tree.getRoot().toString('hex')))
    }
    catch(error){
        console.log(error)
    }
}

GenerateProofs().then()