const { match } = require("assert");

let ins = 0;
let cnt_all = 0;

function tagNameUniq(tag_children, child_name)
{
  let cnt = 0;
  for (let ch of tag_children)
  {
    if (ch['name'] && ch.name == child_name)
      cnt ++;
  }
  return cnt < 2;
}


function setAttrValue(clone, attrname, attrvalue_str)
{
  if (attrname.replace('ns2:', '') == 'consumer_total')
    clone[attrname] = Number(attrvalue_str);
  else if (attrname.replace('ns2:', '').startsWith('date_') || attrname.replace('ns2:', '').endsWith('_date'))
  {
    clone[attrname] = attrvalue_str;
    clone[attrname + "_dt"] = new Date(attrvalue_str);
  } 
}


//клонирование структуры тэга с ее упрощением (уменьшение уровней вложенности и убиранием лишних структур - иначе слишком большие структуры не помещаются в бд)
function cloneTag(tag, copy_parent = 100, copy_children = true, level = 1, smnnList = undefined, klpList = undefined, MNN_UUID = "", MNN = "", SMNN_UUID = "")
{
  let clone = {}; 
  if (tag instanceof Object)
  {
    if ( tag.name )
      clone.tag_name = tag.name;
    
      //клонирование родителей до 100 уровня
    if (copy_parent > 0 && tag['parent'])
      clone.parent = cloneTag(tag.parent, copy_parent - 1, false, level + 1);

    //клонировние атрибутов  
    if (tag['attributes']){
      for (let attr in tag.attributes)
      {
        clone['attr_' + attr] = tag.attributes[attr];    
      }
    }

    //клонирование детей с поднятием уровня (через 1 или на 1)
    if (copy_children && tag['children'] && tag.children.length > 0)
    {
      let lSMNN_UUID = null;
      //запоминаем текущий SMNN UUID
      if (tag.name.toUpperCase() == 'NS2:SMNN')
        lSMNN_UUID = clone.attr_UUID;

      if (tag.name.toUpperCase() == "NS2:SMNN_LIST") //smnn - Отдельная коллекция подчиненная
      {
          clone.children = [];
          if (typeof smnnList == 'undefined')
            smnnList = [];
          for (let child of tag.children) 
          { 
            let clChild = cloneTag(child, 100, true, 1, undefined, klpList, MNN_UUID, MNN, SMNN_UUID); //клонируем smnn 
            
            clChild.parent_MNN_UUID = MNN_UUID; //проставялем внешние ключи  - это самый высокий уровень МНН
            smnnList.push(clChild);
            clone.children.push(clChild.attr_UUID); //в оригинальный элемент запоминаем только UUID KLP
          }    
      }
      else if (tag.name.toUpperCase() == "NS2:KLP_LIST") //klp - Отдельная коллекция подчиненная
      {
          clone.children = [];
          clone.TradeNames = [];
          clone.RegDocs = [];

          clone.lp = [];

          if (typeof klpList == 'undefined')
            klpList = [];
          for (let child of tag.children) 
          { 
            let clChild = cloneTag(child, 100, true, 1); //клонируем КЛП 
            
            clChild.parent_MNN_UUID = MNN_UUID; //проставялем внешние ключи  - это самый высокий уровень МНН
            clChild.parent_MNN = MNN; //проставялем внешние ключи  - это самый высокий уровень МНН (наименование)
            clChild.parent_SMNN_UUID = SMNN_UUID; //это подчиненный СМНН

            klpList.push(clChild);
            clone.children.push(clChild.attr_UUID); //в оригинальный элемент запоминаем только UUID KLP
            if (clone.TradeNames.indexOf(clChild.trade_name) == -1)
            {
              clone.TradeNames.push(clChild.trade_name); 
            }
            RegDoc = {};
            RegDoc.trade_name = clChild.trade_name;
            RegDoc.num_reg = clChild.num_reg;
            RegDoc.date_reg = clChild.date_reg;
            try
            {
              RegDoc.owner_name = clChild.owner.name;
              RegDoc.owner_country_name = clChild.owner.country_name;
            }
            catch(err)
            {

            }  
            RegDoc.date_reg_end = clChild.date_reg_end;
            RegDoc.klpList = [];
            RegDoc.limPriceList = [];
            RegDoc.klpList.push(clChild.attr_UUID);
            
            let RegDocRef = RegDoc;
            let isExist = false;
            for (let rd of clone.RegDocs)   
            {
              let match = true;
              for(let attr in rd)
              {
                if(attr != 'klpList' && rd[attr] != RegDoc[attr])
                {
                  match = false;
                  break;
                }
              }
              if (match)
              { 
                RegDocRef = rd;
                isExist = true;
                break;
              }
            }
            RegDocRef.klpList.push(clChild.attr_UUID);
            /*if (lChild.klp_lim_price_list) && lChild.klp_lim_price_list.children)
              for(let lim_price of lChild.klp_lim_price_list.children)
              {
                let limprc = {};
                limprc.barcode = lim_price.barcode;
                limprc.price_value = lim_price.price_value;
                limprc.reg_date = lim_price.reg_date;
                limprc.date_end = lim_price.date_end;
              }*/
   
            if (!isExist)
              clone.RegDocs.push(RegDoc);  
          }    
      }
      else if (tag.children.length == 1 //если ребенок один, его можно перенести в реквизит родителя (кроме списков)
        && tag.children[0]['name'] //если есть имя создаем такой реквизит с именем
        && tag.name.indexOf('list') == -1 ) //для списков обязательно должны быть дети, даже если он 1
      {
        child = tag.children[0];
        childName = child.name.replace('ns2:', '');
        if (child instanceof Object)
          clone[childName] = cloneTag(child, 0, true, level + 1, smnnList, klpList, MNN_UUID, MNN, lSMNN_UUID)
        else
          setAttrValue(clone, childName, child);    
      }
      else
      {
        clone.children = [];
        for (let child of tag.children) 
        {
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
              clone[childName] = cloneTag(chld, 0, true, level + 1, smnnList, klpList, MNN_UUID, MNN, lSMNN_UUID)
            else
              setAttrValue(clone, childName, chld); 
                                                   
          }
          else 
          { 
            let chld = child;
            if (child['children'] 
                && child.children.length == 1
                && child['name']
                && child.name.indexOf('list') == -1)
            {
              chld = {};
              chld[child.name] = child.children[0];
            }
            clone.children.push(chld instanceof Object 
                            ? 
                            cloneTag(chld, 0, true, level + 1, smnnList, klpList, MNN_UUID, MNN, lSMNN_UUID) : chld); 
          }

        }
        if (clone.children.length == 0)
          delete clone.children;
      } 
    }
    //клонируем все остальные реквизиты  
    for (let key in tag)
    {
      if (key != 'attributes' && key != 'name' && key != 'children' && key != 'parent' && key != 'isSelfClosing')
      {
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
  }
  else 
    clone = tag;  
  return clone;  
}
  

 


function loadFile(filePath) {
  
  const MongoClient = require("mongodb").MongoClient;
  const fs = require("fs");



  const client = new MongoClient("mongodb://127.0.0.1:27017");

  
  client.connect().then((mongoClient => {
    console.log("Подключение установлено");
    //console.log(mongoClient.options.dbName); // получаем имя базы данных
    //console.log("Connected successfully to server");

    
    let Errors = [];
    products = [];
    let klpList = [];
    let smnnList = [];

    const db = client.db("esklp_service");
    const collectionMNN = db.collection("mnn");
    const collectionSMNN = db.collection("smnn");
    const collectionKLP = db.collection("klp");

      
    let batchTemp = [];
    function saveDataBatch(data) {
      if (data instanceof Object) {
        if (batchTemp.length < 100) {
          batchTemp.push(data);
          //xml.resume();
          ins++;
          /*if (ins % 10 == 0)
            console.info("➕  ", ins);*/
        } else {
  
          // xml.pause();
          if (batchTemp.includes(data))
            console.log("Duplicate object " + data);
          else {
            batchTemp.push(data);
            collectionMNN.insertMany(batchTemp).then(result => {
              //console.log(data);
              console.info("➕  " + ins + " all " + cnt_all);
              //xml.resume()
            },
              err => {
                console.log(data);
                Errors.push(err);
                //xml.resume();
              });
            batchTemp = [];
            collectionSMNN.insertMany(smnnList).then(result => {
              console.info("smnn");
            },
              err => {
                console.log(err);
                Errors.push(err);
              });
            smnnList = [];
            collectionKLP.insertMany(klpList).then(result => {
              console.info("klp");
            },
              err => {
                console.log(err);
                Errors.push(err);
              });
            klpList = [];
          }
        }
      }
    }

    console.log("Current directory:", __dirname);

    /*const streamWrite = fs.createWriteStream("./data/extract.json");
    function saveToFile(data) {
      streamWrite.write(data);
    }*/

    const path = require('path')
    const clientPath = filePath;//path.join(__dirname, 'data/esklp_20230602_active_21.5_00001_0001.xml')
    //const stream = fs.createReadStream  ("/home/victor/projects/Node/esklp/data/esklp_20230602_active_21.5_00001_0001.xml");


    //var parser = sax.parser(true);

    var sax = require('./sax.js')

    var saxStream = sax.createStream(true)

    const tagCollect = "NS2:GROUP";
    
        
    cur_ch = undefined
    product = undefined
    currentTag = undefined

    saxStream.on("closetag", function (tagName) {
      cnt_all++;
      if (tagName.toUpperCase() === tagCollect && product != null) {
        if (product.children.length > 1) {
        // normalizeProduct(product);
          product_clone = cloneTag(product, 100, true, 1, smnnList, klpList, product.attributes.UUID, product.attributes.name);
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
      //console.log(tagName);
    })

    saxStream.on("opentag", function (tag) {
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
      //console.log(tag.name);
    })

    saxStream.on("text", function (text) {
      if (currentTag)
        currentTag.children.push(text)
      //console.log(text);
    });

    saxStream.on("end", function () {
      console.log("finished document!");
    });

    const stream = fs.createReadStream(clientPath)
      .pipe(saxStream);
  
    }), err => {
    console.log(err);
  });
}

if (require.main === module) {
  if (process.argv.length < 3)
    console.log("Необходимо передать путь к файлу в качестве аргумента");
  else  
    loadFile(process.argv[2]);
}


