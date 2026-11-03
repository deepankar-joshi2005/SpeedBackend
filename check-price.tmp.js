const mongoose = require("mongoose");

async function main() {
  const uri = "mongodb://speedadmin:Mandeep1x5g1988@127.0.0.1:27017/speedEducation?authSource=speedEducation";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const coll = db.collection("testseries");

  const regex = /uttarakhand|uttarkhand/i;
  const docs = await coll.find({ title: regex }).toArray();

  if (docs.length === 0) {
    console.log("No testseries found matching 'uttarakhand/uttarkhand'. Trying broader search across collections...");
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name).join(", "));
  }

  for (const d of docs) {
    console.log("----");
    console.log("_id:", String(d._id));
    console.log("title:", d.title);
    console.log("accessType:", d.accessType);
    console.log("isPaid:", d.isPaid);
    console.log("price:", d.price);
    console.log("coachingAccessType:", d.coachingAccessType);
    console.log("coachingPrice:", d.coachingPrice);
    console.log("category:", d.category);
    console.log("type:", d.type);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
