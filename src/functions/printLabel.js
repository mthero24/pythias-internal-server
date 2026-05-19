import ipp from "ipp";
import axios from "axios";
import btoa from "btoa";
import atob from "atob"
export const print = async ({label, printer, type}) => {
    console.log(type, "type", label)
    let data
    if(type == "pdf"){
        let headers = {
            headers:{
                "Content-Type": "application/json",
                "x-rapidapi-host": "html-to-zpl.p.rapidapi.com'",
                "x-rapidapi-key": process.env.RAPIDAPI_KEY

            }
        }
        let res = await axios.post("https://html-to-zpl.p.rapidapi.com/pdf2zpl",{pdfBase64: btoa(atob(label)), width:4, height: 6, dpi: 203, speed: 2, scale: "fitToWidth"}, headers).catch(e=>{console.log(e.response.data)})
        console.log(res.data)
        data = res.data
        data = Buffer.from(btoa(data), "base64")
    }else{
        console.log(label, "before convert")
        data = Buffer.from(label, "base64")
    }
    console.log(printer)
    var printer = ipp.Printer(printer);
    var msg = {
        "version": "1.0",
        "operation-attributes-tag": {
            "requesting-user-name": "",
            "job-name": "My Test Job",
        },
        data: data
    };
    return await new  Promise((resolve)=>{
        printer.execute("Print-Job", msg, function(err, res) {
            if (err) {
                console.log("error", err)
                resolve({error: true, msg: JSON.stringify(err), res})
            }
            else {
                    console.log("sent to " , printer)
                    console.log("response", res)
                    resolve({error: false, msg: "printed", res})
            }
        });
    })
}
