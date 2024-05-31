const { match } = require("assert");
const { v4: uuidv4 } = require('uuid');

const path = require('path')
  
const logging = require('./logger.js');

let ins = 0;
let cnt_all = 0;

function tagNameUniq(tag_children, child_name) {
  let cnt = 0;
  for (let ch of tag_children) {
    if (ch['name'] && ch.name == child_name)
      cnt++;
  }
  return cnt < 2;
}


function setAttrValue(clone, attrname, attrvalue_str) {
  if (attrname.replace('ns2:', '') == 'consumer_total')
    clone[attrname] = Number(attrvalue_str);
  else if (attrname.replace('ns2:', '').startsWith('date_') || attrname.replace('ns2:', '').endsWith('_date')) {
    clone[attrname] = attrvalue_str;
    clone[attrname + "_dt"] = new Date(attrvalue_str);
  }
  else
    clone[attrname] = attrvalue_str;

}


//клонирование структуры тэга с ее упрощением (уменьшение уровней вложенности и убиранием лишних структур - иначе слишком большие структуры не помещаются в бд)
function cloneTag(tag, copy_parent = 100, copy_children = true, level = 1, smnnList = undefined, lpList = undefined, klpList = undefined, MNN_UUID = "", MNN = "", SMNN_UUID = "", clone_parent = undefined) {
  let clone = {};
  if (tag instanceof Object) {
    if (tag.name)
      clone.tag_name = tag.name;

    //клонирование родителей до 100 уровня
    if (copy_parent > 0 && tag['parent'])
      clone.parent = cloneTag(tag.parent, copy_parent - 1, false, level + 1);

    //клонировние атрибутов  
    if (tag['attributes']) {
      for (let attr in tag.attributes) {
        clone['attr_' + attr] = tag.attributes[attr];
      }
    }


    //клонируем все остальные реквизиты  
    for (let key in tag) {
      if (key != 'attributes' && key != 'name' && key != 'children' && key != 'parent' && key != 'isSelfClosing') {
        /*if (key == 'consumer_total')
          clone[key] = Number(tag[key]);
        else if (key.startsWith('date_') || key.endsWith('_date'))
        {
          clone[key] = tag[key];
          clone[key + "_dt"] = Date.parse(tag[key]);
        }  
        else*/
        clone[key] = tag[key];
      }
    }

    //клонирование детей с поднятием уровня (через 1 или на 1)
    if (copy_children && tag['children'] && tag.children.length > 0) {
      let lSMNN_UUID = null;
      //запоминаем текущий SMNN UUID
      if (tag.name.toUpperCase() == 'NS2:SMNN')
        lSMNN_UUID = clone.attr_UUID;

      if (tag.name.toUpperCase() == "NS2:SMNN_LIST") //smnn - Отдельная коллекция подчиненная
      {
        clone.children = [];
        if (typeof smnnList == 'undefined')
          smnnList = [];
        for (let child of tag.children) {
          let clChild = cloneTag(child, 100, true, 1, undefined, lpList, klpList, MNN_UUID, MNN, SMNN_UUID); //клонируем smnn 

          clChild.parent_MNN_UUID = MNN_UUID; //проставялем внешние ключи  - это самый высокий уровень МНН
          smnnList.push(clChild);
          clone.children.push(clChild.attr_UUID); //в оригинальный элемент запоминаем только UUID KLP
        }
      }
      else if (tag.name.toUpperCase() == "NS2:KLP_LIST") //klp - Отдельная коллекция подчиненная
      {

        clone.children = [];

        //clone.lp = [];

        if (typeof lpList == 'undefined')
          lpList = [];

        if (typeof klpList == 'undefined')
          klpList = [];



        for (let child of tag.children) {
          let clChild = cloneTag(child, 100, true, 1); //клонируем КЛП 
          /*if (clChild.code == "21.10.51.121-000003-1-00167-2000001178496")
            logging('parser',"Found! " + clChild.code) */

          clChild.parent_MNN_UUID = MNN_UUID; //проставялем внешние ключи  - это самый высокий уровень МНН
          clChild.parent_MNN = MNN; //проставялем внешние ключи  - это самый высокий уровень МНН (наименование)
          clChild.parent_SMNN_UUID = SMNN_UUID; //это подчиненный СМНН
          clChild.parent_SMNN_code = clone_parent.code; //это подчиненный СМНН
          clChild.form = clone_parent.form;

          klpList.push(clChild);
          clone.children.push(clChild.attr_UUID); //в оригинальный элемент запоминаем только UUID KLP

          LekPrep = {};
          LekPrep.parent_SMNN_UUID = SMNN_UUID;
          LekPrep.mnn = MNN;
          LekPrep.trade_name = clChild.trade_name;
          //LekPrep.date_change = clChild.date_change;
          LekPrep.num_reg = clChild.num_reg;
          LekPrep.date_reg = clChild.date_reg;
          try {
            LekPrep.owner_name = clChild.owner.name;
            LekPrep.owner_country_name = clChild.owner.country_name;
          }
          catch (err) {
          }
          try {
            LekPrep.manufacturer_name = clChild.manufacturer.name;
            LekPrep.manufacturer_country_name = clChild.manufacturer.country_name;
          }
          catch (err) {
          }

          LekPrep.date_reg_end = clChild.date_reg_end;
          LekPrep.klpList = [];
          // LekPrep.limPriceList = [];

          LekPrep.dosage_norm_name = clChild.dosage_norm_name;
          LekPrep.dosage_num = clone_parent.dosage.dosage_num;
          LekPrep.dosage_grls_value = clone_parent.dosage.grls_value;
          LekPrep.dosage_unit_name = clone_parent.dosage.dosage_unit.name;
          LekPrep.dosage_okei_name = clone_parent.dosage.dosage_unit.okei_name;
          LekPrep.dosage_okei_code = clone_parent.dosage.dosage_unit.okei_code;
          LekPrep.dosage_user_name = clone_parent.dosage.dosage_user.name;
          LekPrep.dosage_user_okei_name = clone_parent.dosage.dosage_user.okei_name;
          LekPrep.dosage_user_okei_code = clone_parent.dosage.dosage_user.okei_code;
          LekPrep.ftg = clone_parent.ftg;
          LekPrep.form = clone_parent.form;
          LekPrep.lf_norm_name = clChild.lf_norm_name;
          LekPrep.pack1_name = clChild.pack_1.name;
          LekPrep.dosage_norm_name = clChild.dosage_norm_name;
          LekPrep.is_znvlp = clChild.is_znvlp;
          LekPrep.is_narcotic = clChild.is_narcotic;
          if (clChild.date_end)
            LekPrep.date_end = clChild.date_end.substr(0, clChild.date_end.indexOf('T'));
          LekPrep.okpd2 = clone_parent.okpd2;


          //LekPrep.klpList.push(clChild.attr_UUID);

          let LPRef = LekPrep;
          let isLPExist = false;
          for (let lp of lpList) {
            let match = true;
            for (let attr in LekPrep) {
              if (attr != 'klpList' && attr != 'UUID' && lp[attr] != LekPrep[attr]) {
                match = false;
                break;
              }
            }
            if (match) {
              LPRef = lp;
              isLPExist = true;
              break;
            }
          }
          LPRef.klpList.push(clChild.attr_UUID);
          /*if (lChild.klp_lim_price_list) && lChild.klp_lim_price_list.children)
            for(let lim_price of lChild.klp_lim_price_list.children)
            {
              let limprc = {};
              limprc.barcode = lim_price.barcode;
              limprc.price_value = lim_price.price_value;
              limprc.reg_date = lim_price.reg_date;
              limprc.date_end = lim_price.date_end;
            }*/

          if (!isLPExist) {
            LekPrep.UUID = uuidv4();
            lpList.push(LekPrep);
          }
        }
      }
      else if (tag.children.length == 1 //если ребенок один, его можно перенести в реквизит родителя (кроме списков)
        && tag.children[0]['name'] //если есть имя создаем такой реквизит с именем
        && tag.name.indexOf('list') == -1) //для списков обязательно должны быть дети, даже если он 1
      {
        child = tag.children[0];
        childName = child.name.replace('ns2:', '');
        if (child instanceof Object)
          clone[childName] = cloneTag(child, 0, true, level + 1, smnnList, lpList, klpList, MNN_UUID, MNN, lSMNN_UUID, clone)
        else
          setAttrValue(clone, childName, child);
      }
      else {
        clone.children = [];
        for (let child of tag.children) {
          /* if (tag.name = '')
             klpList*/
          if (child['name']
            && tag.name.indexOf('list') == -1) //вместо "детей" - реквизит 
          {
            let chld = child;

            if (child['children']
              && child.children.length == 1
              && child.name.indexOf('list') == -1)
              chld = child.children[0]; //когда у ребенка есть 1 ребенок - то перепрыгиваем через уровень 

            childName = child.name.replace('ns2:', '');
            if (chld instanceof Object)
              clone[childName] = cloneTag(chld, 0, true, level + 1, smnnList, lpList, klpList, MNN_UUID, MNN, lSMNN_UUID, clone)
            else
              setAttrValue(clone, childName, chld);

          }
          else {
            let chld = child;
            if (child['children']
              && child.children.length == 1
              && child['name']
              && child.name.indexOf('list') == -1) {
              chld = {};
              chld[child.name] = child.children[0];
            }
            clone.children.push(chld instanceof Object
              ?
              cloneTag(chld, 0, true, level + 1, smnnList, lpList, klpList, MNN_UUID, MNN, lSMNN_UUID) : chld);
          }

        }
        if (clone.children.length == 0)
          delete clone.children;
      }
    }

  }
  else
    clone = tag;
  return clone;
}

let Errors = [];
products = [];
let klpList = [];
let smnnList = [];
let lpList = [];


const MongoClient = require("mongodb").MongoClient;

const client = new MongoClient("mongodb://127.0.0.1:27017");

let db = undefined;
let collectionMNN = undefined;
let collectionSMNN = undefined;
let collectionLP = undefined;
let collectionKLP = undefined;

//logging('parser',mongoClient.options.dbName); // получаем имя базы данных
//logging('parser',"Connected successfully to server");

async function fileAlreadyLoaded(fileName)
{
   mongoClient = await client.connect();
   logging('parser', "(fileAlreadyLoaded check) Connected to DB");

    db = client.db("esklp_service");

    collectionLoadinfo = db.collection("load_info");
    cursorLoaded = await  collectionLoadinfo.findOne({file_name : fileName});
    if (cursorLoaded !== null)
    {
      /*countLoaded = await cursorLoaded.count();
      if (countLoaded > 0)
      {*/
        logging('parser', "File " + fileName + " already loaded");  
        return true;
      //}
    } 
    return false;
}


function diff_hours(dt2, dt1)  {

  var diff =(dt2.getTime() - dt1.getTime()) / 1000;
  diff /= (60 * 60);
  return Math.abs(Math.round(diff));
  
 }

 function diff_minutes(dt2, dt1)  {

  var diff =(dt2.getTime() - dt1.getTime()) / 1000;
  diff /= 60;
  return Math.abs(Math.round(diff));
  
 }


async function checkStartLoad(fileName)
{
  mongoClient = await client.connect();
  logging('parser', "(checkStartLoad) Connected to DB");

  db = client.db("esklp_service");

  collectionLoadinfoStart = db.collection("load_info_start");
  cursorLoaded = await  collectionLoadinfoStart.findOne({file_name : fileName});
    
  if (cursorLoaded !== null)
  {
    /*countLoaded = await cursorLoaded.count();
    if (countLoaded > 0)
    {
      arr = await cursorLoaded.toArray();*/
      start_time = cursorLoaded.start_time;
      diffMins = diff_minutes(new Date(), start_time);
      if(diffMins < 20)
      {
        logging('parser', "File " + fileName + " have already started to load at " + start_time);  
        return false;
      }  
  //}
  }
  else 
  {
    collectionLoadinfoStart.insertOne({start_time : new Date(), 
                                 file_name : fileName});
  }

   return true;
}



async function loadFile(filePath, fileNameZIP = "", endOfLoadCallback = undefined) {

  const fs = require("fs");
  //const path = require("path");

  mongoClient = await client.connect();
  logging('parser', "Connected to DB");

   try {
    db = client.db("esklp_service");

    if (await fileAlreadyLoaded(path.basename(filePath)))
    {
      fs.unlinkSync(filePath);        
      return;
    } 
    collectionMNN = db.collection("mnn_load");
    collectionSMNN = db.collection("smnn_load");
    collectionLP = db.collection("lp_load");
    collectionKLP = db.collection("klp_load");

    await collectionMNN.deleteMany({});
    await collectionSMNN.deleteMany({});

    collectionLP.createIndex({ "manufacturer_name": 1 });
    collectionLP.createIndex({ "mnn": 1 });
    collectionLP.createIndex({ "num_reg": 1 });
    collectionLP.createIndex({ "trade_name": 1 });
    

    await collectionKLP.deleteMany({});
    collectionKLP.createIndex({ "attr_UUID": 1 });
    collectionKLP.createIndex({ "klp_lim_price_list.children.price_value": 1 });
    collectionKLP.createIndex({ "num_reg": 1 });
    collectionKLP.createIndex({ "parent_SMNN_UUID": 1 })
  }
  catch (error) {
    logging('parser', error, true);
    return
  };



  let batchTemp = [];

  function saveDataBatch(data) {
    if (data instanceof Object) {
      if (batchTemp.length < 10) {
        batchTemp.push(data);
        //xml.resume();
        ins++;
        /*if (ins % 10 == 0)
          console.info("➕  ", ins);*/
      } else {

        // xml.pause();
        if (batchTemp.includes(data))
          logging('parser', "Duplicate object " + data, true);
        else {
          batchTemp.push(data);
          saveToDB();
       
        }
      }
    }
  }


  async function saveToDB(last_save = false) {

    
    collectionMNN.insertMany(batchTemp).then(result => {
      //logging('parser',data);
      logging('parser',"mnn ➕  " + ins + " all " + cnt_all);
      //xml.resume()
    },
      err => {
        logging('parser', err, true);
        Errors.push(err);
        //xml.resume();
      });
    batchTemp = [];
    collectionSMNN.insertMany(smnnList).then(result => {
      //logging('parser',"smnn");
    },
      err => {
        logging('parser', err, true);
        Errors.push(err);
      });
    smnnList = [];

    collectionLP.insertMany(lpList).then(result => {
      //logging('parser',"lp");
    },
      err => {
        logging('parser', err, true);
        Errors.push(err);
      });
    lpList = [];
    collectionKLP.insertMany(klpList).then(result => {
      //console.info("klp");
      if (last_save)
        renameCollections();
    },
      err => {
        logging('parser', err, true);
        Errors.push(err);
      });
    klpList = [];
  }

  logging('parser', "Current directory:" + __dirname);

  /*const streamWrite = fs.createWriteStream("./data/extract.json");
  function saveToFile(data) {
    streamWrite.write(data);
  }*/

  const clientPath = filePath;//path.join(__dirname, 'data/esklp_20230602_active_21.5_00001_0001.xml')
  //const stream = fs.createReadStream  ("/home/victor/projects/Node/esklp/data/esklp_20230602_active_21.5_00001_0001.xml");


  //var parser = sax.parser(true);

  var sax = require('./sax.js')

  var saxStream = sax.createStream(true)

  const tagCollect = "NS2:GROUP";

  async function renameCollection(collectionNameOld, collectionNameNew) {
    const collection_old = db.collection(collectionNameOld);
    const collection_new = db.collection(collectionNameNew);

    await collection_new.drop()
    logging('parser',collectionNameNew + " dropped");
    await collection_old.rename(collectionNameNew);
    logging('parser',collectionNameOld + " renamed to " + collectionNameNew);
    
/*collection_old.rename(collectionNameNew).then(result => {
        logging('parser',collectionNameOld + " renamed to " + collectionNameNew);
      },
        err => {
          logging('parser', "Err rename coll " + collectionNameNew + " : " + err, true);
          Errors.push(err);
        });
    },
      err => {
        logging('parser', "Err drop coll " + collectionNameNew + " : " + err, true);
        Errors.push(err);
      });*/
  }

  async function renameCollections() {

    let mnnCount = await db.collection("mnn_load").countDocuments();
    let smnnCount = await db.collection("smnn_load").countDocuments();
    let lpCount = await db.collection("lp_load").countDocuments();
    let klpCount = await db.collection("klp_load").countDocuments();

    await renameCollection("mnn_load", "mnn");
    await renameCollection("smnn_load", "smnn");
    await renameCollection("lp_load", "lp");
    await renameCollection("klp_load", "klp");

    let fileName = path.basename((fileNameZIP === "") ? filePath : fileNameZIP);
    collectionLoadinfo = db.collection("load_info");
    //collectionLoadinfo.deleteMany({}).then(result => {
    await   collectionLoadinfo.insertOne({update_time : new Date(), 
                                    mnn_count : mnnCount, 
                                    smnn_count : smnnCount,
                                    lp_count : lpCount,
                                    klp_count : klpCount,
                                    file_name : fileName});
      logging('parser', 'inserted load_info update time ');
    
    /*},
      err => {
        logging('parser', "Err deleteMany collectionLoadinfo : " + err, true);
        Errors.push(err);
      });*/
    //collectionLoadinfo.update({_id : 1}, {update_time : new Date()}, { upsert: true });
    
  }

  cur_ch = undefined
  product = undefined
  currentTag = undefined

  saxStream.on("closetag", function (tagName) {
    cnt_all++;
    if (tagName.toUpperCase() === tagCollect && product != null) {
      if (product.children.length > 1) {
        // normalizeProduct(product);
        product_clone = cloneTag(product, 100, true, 1, smnnList, lpList, klpList, product.attributes.UUID, product.attributes.name);
        products.push(product_clone)
        saveDataBatch(product_clone)
        currentTag = product = product_clone = null
        return
      }
    }
    if (currentTag && currentTag.parent) {
      var p = currentTag.parent
      //delete currentTag.parent
      currentTag = p
    }
    //logging('parser',tagName);
  })

  saxStream.on("opentag",  function (tag) {
    if (tag.name.toUpperCase() !== tagCollect && !product) return
    if (tag.name.toUpperCase() === tagCollect) {
      product = tag;
    }
    tag.parent = currentTag
    tag.children = []
    tag.parent && tag.parent.children.push(tag)
    /*if (tag.parent)
      tag.parent[tag.name.replace('NS2:', '')] = tag;*/
    currentTag = tag
    //logging('parser',tag.name);
  })

  saxStream.on("text", function (text) {
    if (currentTag)
      currentTag.children.push(text)
    //logging('parser',text);
  });

  saxStream.on("end", async function () {
    if (batchTemp && batchTemp.length > 0) {
      await saveToDB(true);
    } else
    {
      await renameCollections();
    }
    logging('parser', "finished document!");
    console.timeEnd('parse');
    if (typeof(endOfLoadCallback) != 'undefined')
    {
      setTimeout(() => {
        endOfLoadCallback(filePath);
      }, 2000);
    }  
    return true;
  });

  console.time('parse');
  const stream = fs.createReadStream(clientPath).pipe(saxStream);

}

/*), err => {
  logging('parser',err, true);
  return false;
});
}*/




if (require.main === module) {
  if (process.argv.length < 3)
    logging('parser', "Необходимо передать путь к файлу в качестве аргумента", true);
  else
    loadFile(process.argv[2]);
}

exports.loadFile = loadFile;
exports.fileAlreadyLoaded = fileAlreadyLoaded;
exports.checkStartLoad = checkStartLoad;
