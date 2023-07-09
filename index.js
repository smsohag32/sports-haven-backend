const express = require('express')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const jwt = require('jsonwebtoken')
// middleware

const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.60cwtg1.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

// verify jwt
const verifyJwt = (req,res, next) =>{
  const authorization = req.headers.authorization;
  if(!authorization){
   return res.status(401).send({error: true, message: 'unauthorized access'});
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded)=>{
    if(err){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next()
  })
}



async function run() {
  try {
    const usersCollection = client.db('sportsBD').collection('users');
    const productsCollection = client.db('sportsBD').collection('products');
    const cartsCollection = client.db('sportsBD').collection('carts');
    const ordersCollection = client.db('sportsBD').collection('orders');
    
    // authentication and user save in db

    // jwt
    app.post('/jwt', async(req, res)=> {
        const user = req.body;
        const token = jwt.sign(user,process.env.ACCESS_TOKEN, {expiresIn: '2h'});
        res.send({token})
    })

    // verify admin 
    const verifyAdmin = async(req, res, next)=> {
      const email = req.decoded.email;
      const query = {email: email};
      const user  = await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error: true, message: 'forbidden access'});
      }
      next()
    }
    // check admin 
    app.get('/admin/:email', async(req,res)=> {
        const email = req.params.email;
        if(!email) {
            return res.send({role: false})
        }
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        const result = {role: user?.role === 'admin'};
        res.send(result);
    })

    //  user info save to database 
    app.put('/users/:email', async(req, res)=>{
        const user = req.body;
        const email = req.params.email;
        const query = {email: email};
        const option = {upsert: true};
        const updatedDoc = {
          $set: user
        }
        const result = await usersCollection.updateOne(query,updatedDoc, option);
        res.send(result);
    })

    // all user get in admin 
    app.get('/users', verifyJwt, verifyAdmin, async(req, res)=> {
        const result = await usersCollection.find().sort({date: -1}).toArray();
        res.send(result)
    })

    // single customer get
  app.get('/customer/:id', async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const result = await usersCollection.findOne(query);
    res.send(result);
  })
    // products relate api
    // all product get to db
    app.get('/products', async(req, res) => {
        const result = await productsCollection.find().toArray();
        res.send(result);
    })
//  get single products info

    app.get('/products/:id', async(req, res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await productsCollection.findOne(query);
        res.send(result);
    })

    // post a new product in db

    app.post('/products', verifyJwt, verifyAdmin, async(req, res)=>{
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    })

    // delete a products
    app.delete('/products/:id', verifyJwt,verifyAdmin, async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await productsCollection.deleteOne(query);
        res.send(result)
    })

    // carts related 
    app.post('/carts', async(req, res)=> {
        const product = req.body;
        const result = await cartsCollection.insertOne(product);
        res.send(result)
    })

    // get carts data
    app.get('/carts/:email', verifyJwt, async(req, res)=> {
        const email = req.params.email;
        const query = {email: email}
        const result = await cartsCollection.find(query).toArray();
        res.send(result);
    })

    // delete cart

    app.delete('/carts/:id', verifyJwt, async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await cartsCollection.deleteOne(query);
        res.send(result)
    })


    // completed orders data related api
    app.get('/orders/:email', verifyJwt, async(req, res)=>{
        const email = req.params.email;
        const query = {email: email}
        const result = await ordersCollection.find(query).sort({date:-1}).toArray();
        res.send(result)
    })
    // all user get
    app.get('/orders', verifyJwt, verifyAdmin, async(req, res)=>{
        const result = await ordersCollection.find().sort({date: -1}).toArray();
        res.send(result)
    })

    // get single order details
    app.get('/orders/details/:id', verifyJwt, verifyAdmin, async(req, res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await ordersCollection.findOne(query);
        res.send(result)
    })
    // post completed orders
    app.post('/orders/:email', verifyJwt, async(req, res)=>{
        const newOrder = req.body;
        const email = req.params.email;
        const query = {email: email};
        const removeResult = await cartsCollection.deleteMany(query)
        const result = await ordersCollection.insertOne(newOrder);
        res.send(result);
    })


    // summary overview data

    app.get('/summary', verifyJwt,verifyAdmin, async(req, res) =>{

        const totalOrders = await ordersCollection.estimatedDocumentCount();
        const totalProducts = await productsCollection.estimatedDocumentCount();
        const totalCarts = await cartsCollection.estimatedDocumentCount();
        const totalCustomer = await usersCollection.estimatedDocumentCount();

        res.send({totalCarts, totalCustomer, totalProducts, totalOrders})

    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('sports haven Server is running..')
})

app.listen(port, () => {
  console.log(`sports haven is running on port ${port}`)
})