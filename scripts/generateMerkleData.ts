import { GoogleSpreadsheet } from "google-spreadsheet";
import { MerkleTree } from "merkletreejs";
import { keccak_256 } from 'js-sha3';
import { BigNumber, utils } from "ethers";
import { Int, string } from "io-ts";
import * as fs from 'fs'
import { Console } from "console";

import * as creds from '../sheet_secret.json';
import * as sheetconfig from '../sheet_config.json';
const chunkfilename = "chunk";
const mappingfilename = "mappings"
const fileending = ".json";
const path = "./output/"
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
interface chunkdata { [key: string]: {index: number, amount: string}};

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
        rows.forEach((row) => {
            if(row.HolderAddress.length > 0 && row.HolderAddress != "" && !row.Finalbalance.includes("-") && row.Finalbalance != "0" && row.Finalbalance.length > 0){
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
            leaves.push(Buffer.from(utils.solidityKeccak256(['uint256', 'address', 'uint256'], [pos, row.address, utils.parseUnits(row.amount, 9)]).substr(2),'hex'));
        })
        const tree = new MerkleTree(leaves, keccak_256);
        const root = tree.getHexRoot();

        var index = 0;
        var filecounter = 0;

        var mappingobject = <{start: string, stop: string, file: string}[]>[]
        while(index < data.length){
            var tmpcounter = 0;
            var startaddress = data[index].address
            var tmpobject = <{ [key: string]: {index: number, amount: string, proof: string[]}}>{}
            while(tmpcounter < chunksize && (tmpcounter + index) < data.length){
                var pos = index + tmpcounter;
                tmpobject[data[pos].address] = {index: pos, amount: utils.parseUnits(data[pos].amount, 9).toHexString(), proof: tree.getHexProof(leaves[pos])}
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

        try {
            fs.writeFileSync(path +  mappingfilename + fileending, JSON.stringify(mappingobject))
        } catch (error) {
            console.log(error)
        }
        console.log("Wrote " + (filecounter-1).toString() + " chunks")

    }
    catch(error){
        console.log(error)
    }
}

GenerateProofs().then()