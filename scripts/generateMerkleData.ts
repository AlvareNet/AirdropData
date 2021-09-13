import { GoogleSpreadsheet } from "google-spreadsheet";
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
const path = "./output/slothi/"
const chunksize = 100

function sortData(a: { address: string; amount: string; }, b: { address: string; amount: string; }): number {
    if ( a.address < b.address ){
        return -1;
      }
      if ( a.address > b.address ){
        return 1;
      }
      return 0;
}

async function getData(): Promise< { address: string; amount: string; }[]> {
    try{
        const doc = new GoogleSpreadsheet(sheetconfig.sheet);
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo(); 
        var sheet = doc.sheetsByIndex[0];
        var entries = sheet.rowCount;
        console.log("Loaded: " + sheet.title + " with " + entries + " rows");
        console.log("Getting rows");
        var rows = await sheet.getRows();
        var rows2 = <{address: string, amount: string}[]>[];
        rows.forEach((row, index) => {
            if(row.HolderAddress && row.HolderAddress.length > 0 && row.HolderAddress != "" && row.Finalbalance && row.Finalbalance.length > 0 && !row.Finalbalance.includes("-") && row.Finalbalance != "0"){
                rows2.push({ address: row.HolderAddress, amount: row.Finalbalance })
            }
        });
        return rows2;
    }
    catch(error){
        console.log(error)
    }
    return  <{address: string, amount: string}[]>[];
}

async function GenerateProofs(){
    try{
        var data = await getData()
        data.sort(sortData)
        var leaves = <Buffer[]>[];
        data.forEach((row, pos) => {
            leaves.push(Buffer.from(utils.solidityKeccak256(['uint256', 'address', 'uint256'], [pos, row.address, utils.parseUnits(row.amount, 9).toHexString()]).substr(2),'hex'));
            if(pos == 10000){
                console.log(utils.parseUnits(row.amount, 9).toHexString())
                console.log(pos)
                console.log(row.address)
            }
        })
        console.log(leaves[0])
        const tree = new MerkleTree(leaves, keccak_256, {sortPairs: true});
        const root = tree.getHexRoot();

        var index = 0;
        var filecounter = 0;
        var total = BigNumber.from("0");
        var mappingobject = <{start: string, stop: string, file: string}[]>[]
        while(index < data.length){
            var tmpcounter = 0;
            var startaddress = data[index].address
            var tmpobject = <{ [key: string]: {index: number, amount: string, proof: string[]}}>{}
            while(tmpcounter < chunksize && (tmpcounter + index) < data.length){
                var pos = index + tmpcounter;
                var tmpamount = utils.parseUnits(data[pos].amount, 9);
                total = total.add(tmpamount);
                tmpobject[data[pos].address] = {index: pos, amount: tmpamount.toHexString(), proof: tree.getHexProof(leaves[pos], pos)}
                tmpcounter++;
            }
            index += tmpcounter;
            mappingobject[filecounter] = {start: startaddress, stop: data[index-1].address, file: chunkfilename + filecounter.toString() + fileending}
            try {
                fs.writeFileSync(path +  chunkfilename + filecounter.toString() + fileending, JSON.stringify(tmpobject))
            } catch (error) {
                console.log(error)
            }
            filecounter++;
        }
        var contractvariables = { merkleroot: root, total: total.toString()}
        try {
            fs.writeFileSync(path +  mappingfilename + fileending, JSON.stringify(mappingobject))
            fs.writeFileSync(path +  contractsettings + fileending, JSON.stringify(contractvariables))
        } catch (error) {
            console.log(error)
        }
    }
    catch(error){
        console.log(error)
    }
}

GenerateProofs().then()