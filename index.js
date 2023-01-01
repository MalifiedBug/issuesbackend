import express from "express"; // "type": "module"
import { MongoClient } from "mongodb";
import cors from 'cors'
import * as dotenv from 'dotenv' ;
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use(function(req, res, next) {
  const allowedOrigins = ['https://issuesmanagerfrontend.vercel.app','http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
}    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  

const PORT = process.env.PORT
const MONGO_URL = process.env.MONGO_URL;

//connect mongodb

async function MongoConnect(){
    const client = await new MongoClient(MONGO_URL).connect();
    console.log('🕺 Mongo Connected ')
    return client;
}

const client = await MongoConnect();

//todays date function

let ts = Date.now();

let date_ob = new Date(ts);
let date = date_ob.getDate();
let month = date_ob.getMonth() + 1;
let year = date_ob.getFullYear();

// prints date & time in YYYY-MM-DD format
var newdate = date + "-" + month + "-" + year


app.get("/", function (request, response) {
  response.send("issues backend 📝");
});

//for user

app.post("/issue",async(req,res)=>{
    const {name,email,mobile,issueType,issueTitle,issueDescription} = req.body;
    const issueDb = await client.db("HelpDesk").collection("Issues").insertOne({...req.body,status:"pending",date:newdate});
    if(issueDb){
        res.status(200).send({msg:"issue registered",issueDb})
    }else{
        res.status(400).send({msg:"issue failed to register"})
    }
})

//for user and admin-filter

app.get("/issue/:name", async(req,res)=>{
    const name = req.params['name'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").find({name}).toArray()
    if(issueDb){
        res.status(200).send(issueDb)
    }else{
        res.status(400).send({msg:"issues of the user not found"})
    }
})

//edit issue by user

app.put("/editissue/:id",async(req,res)=>{
    const id = req.params['id'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").updateOne({_id:ObjectId(id)},{$set:{...req.body}})
    if(issueDb){
        console.log(issueDb)
        res.status(200).send({msg:"issue update successfully"})
    }else{
        res.status(400).send({msg:"failed to update; or no issue in db"})
    } 
})

//delete issue by user

app.delete("/deleteissue/:id",async (req,res)=>{
    const id = req.params['id'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").deleteOne({_id:ObjectId(id)})
    if(issueDb){
        console.log(issueDb)
        res.status(200).send({msg:"issue delete successfully"})
    }else{
        res.status(400).send({msg:"failed to delete; or no issue in db"})
    }

})

//for admin

app.get("/allissues",async(req,res)=>{
    const issuesDb = await client.db("HelpDesk").collection("Issues").find({}).toArray();
    res.status(200).send(issuesDb)   
})

//for admin; update issue
app.put("/updateissue/:id",async(req,res)=>{
    const id = req.params['id'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").updateOne({_id:ObjectId(id)},{$set:{...req.body}})
    if(issueDb){
        console.log(issueDb)
        res.status(200).send({msg:"issue update successfully"})
    }else{
        res.status(400).send({msg:"failed to update; or no issue in db"})
    } 
})

app.delete("/deleteresolved",async (req,res)=>{
  const del = await client.db("HelpDesk").collection("Issues").deleteMany({status:"resolved"})
  if(del){
    res.status(200).send({msg:"queries deleted"})
  }
})

app.get("/uniqueusers", async (req,res)=>{
  const users = await client.db("HelpDesk").collection("Users").distinct('name')
  const usersnoadmin = await client.db("HelpDesk").collection("Users").distinct('name',{admin:false})
  const allAdmins = await  client.db("HelpDesk").collection("Users").distinct('name',{admin:true})

  if (users) {
    res.status(200).send({users, usersnoadmin,allAdmins}) 
  } else {
    res.status(200).send({msg:'no users found'})    
  }
})

app.put("/addadmin/:name", async(req,res)=>{
  const name = req.params['name']
  const addadmin = await client.db("HelpDesk").collection("Users").updateOne({name},{$set:{admin:true}})
  res.status(200).send({msg:"admin added"})
  console.log(addadmin)
})

app.put("/deladmin/:name", async(req,res)=>{
  const name = req.params['name']
  const deladmin = await client.db("HelpDesk").collection("Users").updateOne({name},{$set:{admin:false}})
  res.status(200).send({msg:"admin deleted"})
  console.log(deladmin)
})

//sign in sign up services

async function hashedPassword(password) {
    const NO_OF_ROUNDS = 10;
    const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  }

app.post("/signup", async function (request, response) {
    let { name, email, password } = request.body;
    let userdb = await client
      .db("HelpDesk")
      .collection("Users")
      .findOne({ email: email });
    if (userdb) {
      response.status(200).send({ msg: "user already present", userdb });
    } else {
      const hashedPass = await hashedPassword(password);
      let result = await client
        .db("HelpDesk")
        .collection("Users")
        .insertOne({ name,email: email, password: hashedPass, admin: false, doj: newdate });
      response.send({ msg: "user added",name, email, result });
    }
  });
  
  app.post("/signin", async function (request, response) {
    let { email, password } = request.body;
    let userdb = await client
      .db("HelpDesk")
      .collection("Users")
      .findOne({ email: email });
  
    if (userdb) {
      const isSame = await bcrypt.compare(password, userdb.password);
  
      if (isSame) {
        console.log(userdb)
        var name = userdb.name;
        var admin = userdb.admin;
        var token = jwt.sign({ email: email }, process.env.JWT_SECRET);
        response.status(200).send({ msg: "logged in", token, name, admin });
      } else {
        response.status(200).send({ msg: "invalid credentials" });
      }
    } else {
      response.status(200).send({ msg: "no user found" });
    }
  });

  // payment

  app.post("/orders/:id", async(req,res)=>{
    const id = req.params.id;
    console.log(id)
    let amount = 0
    if(id==='1'){
      amount = 120000
      console.log(amount)
    }else {
      amount = 220000
      console.log(amount)
    }
    try {
      const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_SECRET
      });
      const options = {
        amount:amount,
        currency: "INR",
        receipt: "receipt order no 777"
      }  
      
      console.log(options)
      
      const order = await instance.orders.create(options)
      console.log(order)

      if(!order){return res.status(200).send({msg:"Something went wrong"})}

      res.status(200).send(order);     

    } catch (error) {
      console.log("entered error block")
      res.status(200).send({error,msg:"entered error block"})      
    }
  })

  app.post("/success", async (req, res)=>{
    try {
     
      // getting the details back from our font-end
      const {
        orderCreationId,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
    } = req.body;


     // Creating our own digest
        // The format should be like this:
        // digest = hmac_sha256(orderCreationId + "|" + razorpayPaymentId, secret);
        const shasum = crypto.createHmac("sha256", "w2lBtgmeuDUfnJVp43UpcaiT");

        console.log(shasum)
        
        shasum.update(`${orderCreationId}|${razorpayPaymentId}, ${process.env.RAZORPAY_SECRET}`);

        console.log("shasum updated")

        const digest = shasum.digest("hex");


        // comaparing our digest with the actual signature
        if (digest !== razorpaySignature)
           { 
            console.log("signature varification failed")
            return res.status(400).json({ msg: "Transaction not legit!" });
          }

        // THE PAYMENT IS LEGIT & VERIFIED
        // YOU CAN SAVE THE DETAILS IN YOUR DATABASE IF YOU WANT
      
        res.status(200).send({
          msg: "success",
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
        })            
    } catch (error) {
      console.log("entered error bloc")
      res.status(200).send(error)      
    }
  })
 

app.listen(PORT, () => console.log(`The server started in: ${PORT} ✨✨`));