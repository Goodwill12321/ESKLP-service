const fs = require('fs');
const crypto = require('crypto');

const ftp = require("basic-ftp");

const key = 'dfsjvgndfkekjbnweyw23424kjnkj536kj';
const ftpUserFileName = __dirname + '/ftp-user.json';

const parser = require('./parser-sax.js');
//const extractZip = require('extract-zip')
const logging = require('./logger.js');
//const path = require('path');

// Функция для шифрования пароля
function encrypt(password) {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// Функция для расшифровки пароля
function decrypt(encryptedPassword) {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}



function writeUser2File(login, pwd) {
    // Создание JSON-объекта с логином и паролем
    const user = {
        login: login,
        password: encrypt(pwd)
    };

    // Запись JSON-объекта в файл
    fs.writeFileSync(ftpUserFileName, JSON.stringify(user));
}

function readUserFromFile() {
    // Чтение JSON-объекта из файла
    fs.accessSync(ftpUserFileName);
    //{
        const data = fs.readFileSync(ftpUserFileName, 'utf8');
        const userFromFile = JSON.parse(data);
        // Расшифровка пароля
        userFromFile.password = decrypt(userFromFile.password);
        return userFromFile;
    /*}
    else
    {
        throw 'Файл ' + ftpUserFileName + ' не найден!';
    }*/     
}


async function get_LastFileFrom_FTP(downloadDir) {
    const client = new ftp.Client()
    client.ftp.verbose = false;
    userInfo = readUserFromFile();
    try {
        serverESKLP  = "ftp.esklp.rosminzdrav.ru";
        await client.access({
            host: serverESKLP,
            user: userInfo.login,
            password: userInfo.password,
            //secure: true
        })
        logging('ftp', 'Connected to server ' + serverESKLP);
        let fileList = await client.list();
        let lastFile = undefined;
        let lastFileName = "";

        for (let file of fileList) 
        {
            if(file.name.indexOf('_full_') != -1 
            && file.name.endsWith('.zip') 
            && file.name > lastFileName)
            {
                lastFile = file;
                lastFileName = file.name; 
            }
        }
        if (typeof lastFile === "undefined")
        {
            throw 'Не найдены файлы на сервере!';
        }
        let fileNameLocal = downloadDir + "/" + lastFile.name;
        let fileNameWitoutZip = lastFile.name.replace('.zip', '');        
        if (!(await parser.checkStartLoad(fileNameWitoutZip)))
        {   
            logging('ftp', 'File ' + fileNameLocal + ' have been already started load!');
            return null;
        }
        
        if ((await parser.fileAlreadyLoaded(lastFile.name)))
        {   
            logging('ftp', 'File ' + fileNameLocal + ' have been already loaded in DB');
            return null;
        }
        try{
            fs.accessSync(fileNameLocal);
            logging('ftp', 'File ' + fileNameLocal + ' have been already downloaded from FTP');
            return fileNameLocal;
        }
        catch (err) {
            logging('ftp', 'Downloading file ' + lastFile.name + ' to ' + fileNameLocal);
            await client.downloadTo(fileNameLocal, lastFile.name);
        }    
        
        return fileNameLocal;
    }
    catch(err) {
        console.log(err)
        return null;
    }
    client.close()
}




let fileNameZIP = "";

async function loadLastFile(downloadDir)
{
    return await get_LastFileFrom_FTP(downloadDir);
    
 
}


if (require.main === module) {
    if (process.argv.length < 3)
        console.error("Необходимо передать параметр --load-file или 2 параметра: логин и пароль для шифрования и записи в конфигурационный файл");
    else
    {   if(process.argv[2] == '--load-file')
        {
            loadLastFile('.').then(destPath=>{console.log(destPath)});;
        }
        else if(process.argv.length == 4)    
             writeUser2File(process.argv[2], process.argv[3]);
        else
            console.error("Необходимо передать параметр --load-file или 2 параметра: логин и пароль для шифрования и записи в конфигурационный файл");    
    } 
}

exports.loadLastFile = loadLastFile;
