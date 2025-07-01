const fs = require('fs');
function clearFiles(fileName)
{
    let extractDir = downloadDir + "/extract/";
    logging('ftp', 'Removing file ' + fileName);
    fs.unlinkSync(fileName);
    while (fs.existsSync(fileName))
    {
        sleep(1000); 
    }       
    logging('ftp', 'Removing dir ' + extractDir);
    fs.rmdirSync(extractDir); 
    logging('ftp', 'Removing file ' + fileNameZIP);
    fs.unlinkSync(fileNameZIP);        
}

const httpLoader = require('./http-esklp.js');
const ftpLoader = require('./ftp-esklp.js');
const downloadDir = __dirname + '/ESKLP_download';

const parser = require('./parser-sax.js');
const extractZip = require('extract-zip')
const logging = require('./logger.js');
const path = require('path');


async function loadLastFile()
{
    
    fileNameZIP = await httpLoader.loadLastFile(downloadDir);
    
    if (fileNameZIP === null)
    {
         fileNameZIP = await ftpLoader.loadLastFile(downloadDir);
        if (fileNameZIP === null)
        {
            return null;
        }
    }
   
    let extractDir = downloadDir + "/extract/";
    let fileXml = fileNameZIP.replace('.zip', '');
    let filePathXML = extractDir + path.basename(fileXml);

    try{
        fs.accessSync(filePathXML);
        logging('ftp', 'File ' + filePathXML + ' have been already extracted from zip');
        return null;
    }
    catch (err) {
        logging('ftp', 'Extracting file ' + fileNameZIP + ' to folder ' + extractDir);
        await extractZip(fileNameZIP, { dir: extractDir});
        
        const fileList = fs.readdirSync(extractDir);
        for (const fileXml of fileList) {
            logging('ftp', 'Loading file ' + fileXml + ' in folder ' + extractDir);
            filePath = extractDir + fileXml;
            parser.loadFile(filePath, fileNameZIP, clearFiles);
            return filePath;
    }
    /*logging('ftp', 'Removing dir ' + extractDir);
    fs.rmdirSync(extractDir); 
    logging('ftp', 'Removing file ' + fileName);
    fs.unlinkSync(fileName); */
    }
}

if (require.main === module) {
    loadLastFile('.').then(destPath=>{console.log(destPath)});
    
}

exports.loadLastFile = loadLastFile;
