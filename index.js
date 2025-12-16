const express=require('express');
require('dotenv').config();
const cors =require('cors');


const app=express()
const port=process.env.PORT||5000
app.use(express.json())
app.use(cors())

const admin = require("firebase-admin");

const serviceAccount = require("./firebase-admin-sdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const verifyFBtoken=async(req,res,next)=>{
  console.log("headers is :", req.headers?.authorization)
  const token =req.headers.authorization;
if(!token){
  return res.status(401).send({messege:"unauthorized access"})
}

try{
   const idToken=token.split(' ')[1]
   const decoded=await admin.auth().verifyIdToken(idToken)
   console.log("decoded token", decoded)
   req.decoded_email=decoded.email
   next();
}
catch(err){
  res.status(403).send({messege:"unauthorized access"})
}

}

const crypto = require("crypto");

function generateTrackingId() {
  const rand = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `PKG-${rand}`;
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://db-user-65:Fy6lcTzPTzGIuyQo@cluster0.rnsookq.mongodb.net/?appName=Cluster0";
const stripe = require('stripe')(process.env.STRIPE_SECRET);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
const myDB4 = client.db("myDB4");
const myColl4 = myDB4.collection("collBooks");
const wishColl4 = myDB4.collection("collWishBooks");
const userColl4 = myDB4.collection("collUsers");
const libColl4 = myDB4.collection("collLibrarian");
const lib2Coll4 = myDB4.collection("collLibuser");
const usersColl4 = myDB4.collection("collUsers2");
const paymentColl4 = myDB4.collection("collPayment");


const verifyAdmin =async (req, res,next)=>{
  const email=req.decoded_email;
  const query={email}
  const user=await usersColl4.findOne(query)

  if(!user||user.role!=='admin'){
    return res.status(403).send({messege:'forbidden access '})
  }
  next();
}

app.post('/create-checkout-session', async (req, res) => {
  const paymentInfo=req.body
 
  console.log(paymentInfo)
   
  const session = await stripe.checkout.sessions.create({
    
    line_items: [
      {
        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
        price_data: {
          currency:'usd',
          unit_amount:paymentInfo.bookPrice,
          product_data:{
           name: paymentInfo.bookName
          }
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata:{
     parcelId:paymentInfo.parcelId,
     parcelName:paymentInfo.bookName
    },
    customer_email:paymentInfo.email,
    success_url: `${process.env.SITE_DOMAIN}/userDashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    
  });
  console.log(paymentInfo)
   console.log(session)

  res.send({url: session.url});
});

app.patch('/payment-success',async(req,res)=>{
 
const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

const query={transactionId:session.payment_intent}
const paymentExist=await paymentColl4.findOne(query)
console.log ('payment already exist',paymentExist)
if(paymentExist){
  return res.send({messege:'already exist',trackingId:paymentExist.trackingId,transactionId:session.payment_intent})
}
console.log(session)
if(session.payment_status==='paid'){
const id=session.metadata.parcelId
const query={_id:new ObjectId(id)}
const trackingId=generateTrackingId()
console.log(trackingId)
const update=
{
  $set:{
   status:'paid',
   trackingId:trackingId
  }
}
const result=await userColl4.updateOne(query,update)

const payment  ={
  amount:session.amount_total,

  currency:session.currency,
  customerEmail:session.customer_email,
  parcelId: session.metadata.parcelId,
  transactionId:session.payment_intent,
  parcelName:session.metadata.parcelName,
  createdAt:new Date(),
  paymentStatus: session.payment_status,
  trackingId:trackingId
  
}
if(session.payment_status=='paid'){
  const resultPayment=await paymentColl4.insertOne(payment)

return res.send({success:true,modifyParcel:result, paymentInfo:resultPayment,
  trackingId:trackingId,
  transactionId:session.payment_intent
})
}
// return res.send(result)
}
  return res.send({success:false})
  
})

app.get('/payments',verifyFBtoken,async(req,res)=>{
  const email=req.query.email
  
  const query={}
 if(email){
  query.customerEmail=email
 }

if(email!=req.decoded_email){
  return res.status(403).send({messege:"unauthorized access"})
}
console.log(req.headers)
  const cursor = paymentColl4.find(query)
  const result=await cursor.toArray()
  res.send(result)
})
app.post('/users', async(req,res)=>{
    const user=req.body;
    user.role="users"
    user.created_At=new Date()
    const email=user.email
   const userExist=await usersColl4.findOne({email})
   console.log(userExist)
   if(userExist){
    return res.send({messege:"user already exist"})
   }
  const result=await usersColl4.insertOne(user)
  res.send(result)
})

app.get('/users',async(req,res)=>{
  const cursor=usersColl4.find();
  const result=await  cursor.toArray();
  res.send(result)
})
app.get('/users/:email/role',async(req,res)=>{
  const email=req.params.email
  const query={email}
  const user=await usersColl4.findOne(query)
  console.log(user.role)
  res.send({role:user?.role||"users"})
})

app.post('/orders', async(req,res)=>{
    const books=req.body;
   console.log(req.headers)
  const result=await userColl4.insertOne(books)
  res.send(result)
})
app.post('/librarian', async(req,res)=>{
    const orders=req.body;
   
  const result=await libColl4.insertOne(orders)
  res.send(result)
})
app.post('/beLibrarian', async(req,res)=>{
    const users=req.body;
   users.role='users'
  const result=await lib2Coll4.insertOne(users)
  res.send(result)
})
app.get('/beLibrarian',async(req,res)=>{
  const cursor=lib2Coll4.find()
  const result=await  cursor.toArray();
  res.send(result)
})
app.get('/orders',async(req,res)=>{
  const query={}

  const{email}=req.query
  console.log(email)

  if(email){
    query.email=email
  }
  console.log(query)
   const cursor=userColl4.find(query)
  const result=await cursor.toArray()
  res.send(result)

})
app.get('/librarian/:email',async(req,res)=>{
  const email=req.params.email
  const query={}
  if(email){
    query.sellerEmail=email
  }
  const cursor=libColl4.find(query);
  const result=await  cursor.toArray();
  res.send(result)
})
app.get('/orders/:id',async(req,res)=>{
  const id=req.params.id;
  console.log(req.headers)
  const query={_id:new ObjectId(id)}
  const cursor=userColl4.find(query)
  const result=await cursor.toArray()
  res.send(result)
})

// {'librarians api'}
app.post('/books', async(req,res)=>{
    const books=req.body;
   
  const result=await myColl4.insertOne(books)
  res.send(result)
})
app.get('/books',async(req,res)=>{
  const cursor=myColl4.find()
  const result=await cursor.toArray()
  res.send(result)
})
app.get('/recentbooks',async(req,res)=>{
   const status = req.query.status;

  const query = {};
  if (status) {
    query.status = status;
  }
  const cursor=myColl4.find(query).sort({ created_At: -1 }).limit(6);
  const result=await  cursor.toArray();
  res.send(result)
})

app.get('/allBooks', async(req, res) => {
  const sortOrder = req.query.sort === 'asc' ? 1 : -1;
   const status = req.query.status;

  const query = {};
  if (status) {
    query.status = status;
  }

    const cursor = myColl4.find(query).sort({ bookPrice: sortOrder });
    const result=await cursor.toArray();
    res.send(result)
})
app.get('/myBooks',async(req,res)=>{
  const query={}

  const{email}=req.query
  console.log(email)
  const option={sort:{created_At:-1}}
  if(email){
    query.sellerEmail=email
  }
  console.log(query)
   const cursor=myColl4.find(query,option)
  const result=await cursor.toArray()
  res.send(result)

})
app.post('/wishBooks', async(req,res)=>{
    const books=req.body;
     const { bookId, userEmail } = req.body;

  // Check if already exists
  const exists = await wishColl4.findOne({
    bookId,
    userEmail,
  });

  if (exists) {
    return res.status(409).send({
      message: "Already in wishlist",
      exists: true,
    });
  }
  const result=await wishColl4.insertOne(books)
  res.send(result)
})
app.get('/wishBooks',async(req,res)=>{
  const query={}

  const{email}=req.query
  console.log(email)
  const option={sort:{created_At:-1}}
  if(email){
    query.userEmail=email
  }
  console.log(query)
   const cursor=wishColl4.find(query,option)
  const result=await cursor.toArray()
  res.send(result)

})

app.get('/',(req,res)=>{
  res.send('server is running')
})
app.get('/books/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id:new ObjectId(id)}
  const cursor=myColl4.find(query)
  const result=await cursor.toArray()
  res.send(result)
})
app.patch('/booksLike/:id',async(req,res)=>{
  const id=req.params.id;
  const {likes}=req.body;
  const query={_id:new ObjectId(id)}
  const update={
   $set:{
     likes:likes
   }
  }
  const result=await myColl4.updateOne(query,update)
  res.send(result)
})
app.patch('/myBooks/:id',async(req,res)=>{
  const id=req.params.id;
  const updatedProduct=req.body;
  const query={_id:new ObjectId(id)}
  const update={
   $set:{
    bookName:updatedProduct.bookName,
    bookPrice:updatedProduct.bookPrice,
    bookImage:updatedProduct.bookImage,
    status:updatedProduct.status,
   }
  }
  const result=await myColl4.updateOne(query,update)
  res.send(result)
})
app.patch('/userOrders/:id',async(req,res)=>{
  const id=req.params.id;
  
  const query={_id:new ObjectId(id)}
  const update={
   $set:{
  
    status:"cancelled",
   }
  }
  const result=await userColl4.updateOne(query,update)
  res.send(result)
})
app.patch('/usersrole/:email',verifyFBtoken,verifyAdmin,async(req,res)=>{
  const email=req.params.email;
  const {role}=req.body
  const query={email:email}
  const update={
   $set:{
  
    role:role,
   }
  }
  const result=await usersColl4.updateOne(query,update)
  res.send(result)
})
app.patch('/booksP/:id',verifyFBtoken,verifyAdmin,async(req,res)=>{
  const id=req.params.id
   const query={_id:new ObjectId(id)}
  const {status}=req.body
  console.log(status)
  const update={
   $set:{
  
    status:status,
   }
  }
  const result=await myColl4.updateOne(query,update)
  res.send(result)
})
app.patch('/librarianrole/:email',async(req,res)=>{
  const email=req.params.email;
  const {role}=req.body
  const query={email:email}
  const update={
   $set:{
  
    role:role,
   }
  }
  const result=await lib2Coll4.updateOne(query,update)
  res.send(result)
})
app.patch('/librarian/:id',async(req,res)=>{
  const id=req.params.id;
  const status=req.body.lstatus
  const query={_id:new ObjectId(id)}
  const update={
   $set:{
  
    lstatus:status,
   }
  }
  const result=await libColl4.updateOne(query,update)
  res.send(result)
})

app.delete('/allBooks/:id',async (req,res)=>{
  const id=req.params.id
  const query={_id: new ObjectId(id)}
  const result=await myColl4.deleteOne(query)
  res.send(result)
})
app.delete('/users/:id',async (req,res)=>{
  const id=req.params.id
  const query={_id: new ObjectId(id)}
  const result=await usersColl4.deleteOne(query)
  res.send(result)
})
app.delete('/libUser/:id',async (req,res)=>{
  const id=req.params.id
  const query={_id: new ObjectId(id)}
  const result=await lib2Coll4.deleteOne(query)
  res.send(result)
})
app.delete('/librarian/:id',async (req,res)=>{
  const id=req.params.id
  const query={_id: new ObjectId(id)}
  const result=await libColl4.deleteOne(query)
  res.send(result)
})

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
   
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})