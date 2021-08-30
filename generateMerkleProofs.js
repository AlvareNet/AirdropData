const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./sheet_secret.json');
const sheetconfig = require('./sheet_config.json');
const { MerkleTree } = require('merkletreejs');
const { BigNumber, utils } = require('ethers');
const { keccak_256 } = require('js-sha3');
const fs = require('fs');

const storeData = (data, proofname, indexname, prefix) => {
  var currentpointer = 0
  var filecounter = 0
  var indexdata = []
  while(currentpointer < data.length){
    var endpointer = (currentpointer + 99 < data.length-1) ? currentpointer + 99 : data.length-1
    var tmp = data.slice(currentpointer, endpointer)
    currentpointer = endpointer + 1

    var proofnamefile = proofname + filecounter.toString() + ".json"
    tmp.forEach((row) => (indexdata.push({address : row.address, file: proofnamefile})))
    try {
      fs.writeFileSync(prefix + proofname + filecounter.toString() + ".json", JSON.stringify(tmp))
    } catch (err) {
      console.error(err)
    }
    filecounter += 1
  }
  try {
    fs.appendFileSync(prefix + indexname + ".json", JSON.stringify(indexdata))
  } catch (error) {
    console.error(error)
  }

  }



async function GenerateProofs()
{
    try{
        const doc = new GoogleSpreadsheet(sheetconfig.sheet);
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo(); 
    
        var sheet = doc.sheetsByIndex[0];
        var entries = sheet.rowCount;
        console.log("Loaded: " + sheet.title + " with " + entries + " rows");
        console.log("Getting rows");
        var rows = await sheet.getRows();
        const leaves = [];
        const rows2 = [];
        rows.forEach((row) => {
            if(row.HolderAddress.length > 0 && row.HolderAddress != "" && !row.Finalbalance.includes("-") && row.Finalbalance != "0" && row.Finalbalance.length > 0){
                rows2.push(row);
            }
        });

        rows2.forEach((row, index) => (leaves.push(utils.solidityKeccak256(['uint256', 'address', 'uint256'], [index, row.HolderAddress, utils.parseUnits(row.Finalbalance, 9)]).substr(2),'hex')));
        const tree = new MerkleTree(leaves, keccak_256);
        console.log(tree.getHexRoot());
        try {
            fs.writeFileSync("./outdata/merkleroot.json", JSON.stringify(tree.getHexRoot()))
          } catch (err) {
            console.error(err)
          }
        var tmp = tree.getHexProof(leaves[2]);
        //const newsheet = await doc.addSheet({ title: 'MerkleProof sheet!', headerValues: ['index', 'address', 'amount', 'proof'] });
        //console.log("Adding rows to sheet");
        var obj = [];
        rows2.forEach(async(rows2, index) => { obj.push({ index: index, address: rows2.HolderAddress, amount: utils.parseUnits(rows2.Finalbalance, 9).toString(), proof: tree.getHexProof(leaves[index])})});
        storeData(obj, "proofs", "index", "./outdata/");
        //rows.forEach(async(row, index) => {await newsheet.addRows({ index: index, address: row.HolderAddress, amount: utils.parseUnits(row.Finalbalance, 9), proof: tree.getHexProof(leaves[index])})
        //newsheet.save()});    
    }
    catch(e){
        console.log(e);
    }
    finally {

    }
};
GenerateProofs().then();