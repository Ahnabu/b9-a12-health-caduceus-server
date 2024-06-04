const express = require('express');
const cors = require('cors')
require('dotenv').config();
const app = express()
app.use(express.json())
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "b9-a12-health-caduceus.web.app",
            "b9-a12-health-caduceus.firebaseapp.com",
           
        ],
        credentials: true,
    })
);

const port = 5000 || `${process.env.PORT}`
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cn1yph8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
 
 

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
        // database
        const campCollection =client.db('mediDB').collection('camp')

        // get popular collection 
        app.get('/popular', async(req, res) => {
            const result = await campCollection.find().sort({ participantCount:-1 }).limit(6).toArray()
            res.send(result)
        })
        // get all available camp collection 
        app.get('/available-camps', async(req, res) => {
            const result = await campCollection.find().toArray()
            res.send(result)
        })
        // get single card details
        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await campCollection.findOne(query);
            res.send(result);
        })
        
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})