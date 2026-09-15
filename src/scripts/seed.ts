import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db";
import User from "../models/user.model";
import Category from "../models/category.model";
import TestSeries from "../models/testSeries.model";
import Test from "../models/test.model";
import Question from "../models/question.model";
import TestAttempt from "../models/testAttempt.model";

dotenv.config();

type SeedQuestion = {
  subject: string;
  text: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
};

const TEST01_QUESTIONS: SeedQuestion[] = [
  {
    subject: "General Awareness",
    text: "The Reserve Bank of India was established in which year?",
    options: ["1935", "1947", "1950", "1920"],
    correctOptionIndex: 0,
    explanation:
      "The Reserve Bank of India was established on April 1, 1935, under the Reserve Bank of India Act, 1934.",
  },
  {
    subject: "General Awareness",
    text: "Who is known as the 'Father of the Indian Constitution'?",
    options: ["Mahatma Gandhi", "Jawaharlal Nehru", "B. R. Ambedkar", "Sardar Patel"],
    correctOptionIndex: 2,
    explanation: "B. R. Ambedkar chaired the Drafting Committee of the Indian Constitution.",
  },
  {
    subject: "Mathematics",
    text: "What is the value of 15% of 240?",
    options: ["32", "36", "40", "45"],
    correctOptionIndex: 1,
    explanation: "15% of 240 = (15/100) x 240 = 36.",
  },
  {
    subject: "Mathematics",
    text: "If the ratio of two numbers is 3:5 and their sum is 96, find the smaller number.",
    options: ["36", "40", "32", "48"],
    correctOptionIndex: 0,
    explanation: "3+5=8 parts; 96/8=12 per part; smaller number = 3 x 12 = 36.",
  },
  {
    subject: "English Language",
    text: "Choose the correct synonym of 'Abundant'.",
    options: ["Scarce", "Plentiful", "Empty", "Limited"],
    correctOptionIndex: 1,
    explanation: "'Abundant' means existing in large quantities, i.e. plentiful.",
  },
  {
    subject: "English Language",
    text: "Identify the correctly spelled word.",
    options: ["Recieve", "Receive", "Receve", "Receeve"],
    correctOptionIndex: 1,
    explanation: "'Receive' follows the rule 'i before e except after c'.",
  },
  {
    subject: "Logical Reasoning",
    text: "Find the odd one out: Apple, Banana, Carrot, Mango",
    options: ["Apple", "Banana", "Carrot", "Mango"],
    correctOptionIndex: 2,
    explanation: "Carrot is a vegetable; the others are fruits.",
  },
  {
    subject: "Logical Reasoning",
    text: "In a certain code, CAT is written as DBU. How is DOG written in that code?",
    options: ["EPH", "EPI", "FPH", "EOH"],
    correctOptionIndex: 0,
    explanation: "Each letter is shifted forward by 1: D->E, O->P, G->H, giving EPH.",
  },
  {
    subject: "General Awareness",
    text: "Which is the longest river in India?",
    options: ["Yamuna", "Godavari", "Ganga", "Brahmaputra"],
    correctOptionIndex: 2,
    explanation: "The Ganga is the longest river in India, flowing about 2,525 km.",
  },
  {
    subject: "Mathematics",
    text: "A train travels 360 km in 4 hours. What is its speed?",
    options: ["80 km/h", "90 km/h", "100 km/h", "75 km/h"],
    correctOptionIndex: 1,
    explanation: "Speed = Distance/Time = 360/4 = 90 km/h.",
  },
];

const TEST02_QUESTIONS: SeedQuestion[] = [
  {
    subject: "General Awareness",
    text: "The Battle of Plassey was fought in which year?",
    options: ["1757", "1764", "1857", "1748"],
    correctOptionIndex: 0,
    explanation: "The Battle of Plassey was fought on 23 June 1757.",
  },
  {
    subject: "General Awareness",
    text: "Who was the first President of India?",
    options: ["Jawaharlal Nehru", "Dr. Rajendra Prasad", "Dr. S. Radhakrishnan", "Zakir Hussain"],
    correctOptionIndex: 1,
    explanation: "Dr. Rajendra Prasad served as the first President of India from 1950 to 1962.",
  },
  {
    subject: "Mathematics",
    text: "The compound interest on Rs. 10,000 at 10% per annum for 2 years is:",
    options: ["Rs. 2000", "Rs. 2100", "Rs. 2200", "Rs. 1900"],
    correctOptionIndex: 1,
    explanation: "Amount = 10000 x (1.1)^2 = 12100; CI = 12100 - 10000 = Rs. 2100.",
  },
  {
    subject: "Mathematics",
    text: "Find the next number in the series: 2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "38"],
    correctOptionIndex: 1,
    explanation: "Differences are 4, 6, 8, 10, 12; 30 + 12 = 42.",
  },
  {
    subject: "English Language",
    text: "Choose the correct antonym of 'Ancient'.",
    options: ["Old", "Modern", "Historic", "Aged"],
    correctOptionIndex: 1,
    explanation: "'Modern' is the opposite of 'Ancient'.",
  },
  {
    subject: "English Language",
    text: "Fill in the blank: She has been working here ___ 2015.",
    options: ["since", "for", "from", "at"],
    correctOptionIndex: 0,
    explanation: "'Since' is used with a specific point in time.",
  },
  {
    subject: "Logical Reasoning",
    text: "Pointing to a photograph, a man said, 'She is the daughter of my grandfather's only son.' How is the woman related to the man?",
    options: ["Sister", "Mother", "Aunt", "Cousin"],
    correctOptionIndex: 0,
    explanation: "Grandfather's only son is the man's father, so his daughter is the man's sister.",
  },
  {
    subject: "Logical Reasoning",
    text: "If South-East becomes North, North-East becomes West, then what will West become?",
    options: ["North-East", "South-East", "North-West", "South-West"],
    correctOptionIndex: 1,
    explanation: "Each direction rotates 135 degrees anticlockwise; West maps to South-East.",
  },
  {
    subject: "General Awareness",
    text: "The headquarters of the United Nations is located in:",
    options: ["Geneva", "New York", "Paris", "London"],
    correctOptionIndex: 1,
    explanation: "The UN Headquarters is located in New York City, USA.",
  },
  {
    subject: "Mathematics",
    text: "What is the LCM of 12 and 18?",
    options: ["24", "36", "48", "72"],
    correctOptionIndex: 1,
    explanation: "12 = 2^2x3, 18 = 2x3^2; LCM = 2^2x3^2 = 36.",
  },
];

const TEST03_QUESTIONS: SeedQuestion[] = [
  {
    subject: "General Awareness",
    text: "What is the capital of India?",
    options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"],
    correctOptionIndex: 1,
    explanation: "New Delhi is the capital of India.",
  },
  {
    subject: "General Awareness",
    text: "Which gas do plants absorb from the atmosphere for photosynthesis?",
    options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
    correctOptionIndex: 1,
    explanation: "Plants absorb carbon dioxide and release oxygen during photosynthesis.",
  },
  {
    subject: "Mathematics",
    text: "What is 8 + 6 x 2?",
    options: ["28", "20", "16", "22"],
    correctOptionIndex: 1,
    explanation: "By order of operations: 6x2=12, then 8+12=20.",
  },
  {
    subject: "Mathematics",
    text: "Half of 50 is:",
    options: ["20", "25", "30", "15"],
    correctOptionIndex: 1,
    explanation: "50 / 2 = 25.",
  },
  {
    subject: "English Language",
    text: "Choose the plural form of 'Child'.",
    options: ["Childs", "Children", "Childes", "Childrens"],
    correctOptionIndex: 1,
    explanation: "'Children' is the irregular plural of 'Child'.",
  },
  {
    subject: "English Language",
    text: "Opposite of 'Happy' is:",
    options: ["Joyful", "Sad", "Excited", "Glad"],
    correctOptionIndex: 1,
    explanation: "'Sad' is the antonym of 'Happy'.",
  },
  {
    subject: "Logical Reasoning",
    text: "Which number comes next: 2, 4, 6, 8, ?",
    options: ["9", "10", "12", "11"],
    correctOptionIndex: 1,
    explanation: "The series increases by 2 each time; next is 10.",
  },
  {
    subject: "Logical Reasoning",
    text: "Complete the analogy: Sun is to Day as Moon is to ?",
    options: ["Sky", "Night", "Star", "Dark"],
    correctOptionIndex: 1,
    explanation: "The Sun is associated with Day, just as the Moon is associated with Night.",
  },
  {
    subject: "General Awareness",
    text: "The national bird of India is:",
    options: ["Sparrow", "Peacock", "Eagle", "Parrot"],
    correctOptionIndex: 1,
    explanation: "The Indian Peacock is the national bird of India.",
  },
  {
    subject: "Mathematics",
    text: "If a dozen eggs cost Rs. 60, what is the cost of one egg?",
    options: ["Rs. 4", "Rs. 5", "Rs. 6", "Rs. 3"],
    correctOptionIndex: 1,
    explanation: "60 / 12 = 5.",
  },
];

async function seed() {
  await connectDB();

  console.log("Clearing previous catalog + attempt data...");
  await Promise.all([
    TestSeries.deleteMany({}),
    Test.deleteMany({}),
    Question.deleteMany({}),
    TestAttempt.deleteMany({}),
    Category.deleteMany({}),
  ]);

  console.log("Upserting admin account...");
  const adminPasswordHash = await bcrypt.hash("12345678", 10);
  await User.findOneAndUpdate(
    { email: "admin@gmail.com" },
    {
      $set: {
        name: "Admin",
        mobile: "9999999999",
        password: adminPasswordHash,
        role: "admin",
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  console.log("Seeding categories...");
  await Category.insertMany([
    {
      name: "SSC",
      description: "Staff Selection Commission preparation tests",
      iconKey: "book-outline",
      displayOrder: 1,
      isActive: true,
    },
    {
      name: "Banking",
      description: "Bank PO, Clerk & specialist officer preparation tests",
      iconKey: "home-outline",
      displayOrder: 2,
      isActive: true,
    },
    {
      name: "Railway",
      description: "RRB NTPC, Group D & JE preparation tests",
      iconKey: "globe-outline",
      displayOrder: 3,
      isActive: true,
    },
    {
      name: "Police",
      description: "State & central police recruitment preparation tests",
      iconKey: "shield-outline",
      displayOrder: 4,
      isActive: true,
    },
    {
      name: "Defence",
      description: "NDA, CDS & other defence exam preparation tests",
      iconKey: "people-outline",
      displayOrder: 5,
      isActive: true,
    },
  ]);

  console.log("Seeding test series...");
  const seriesDocs = await TestSeries.insertMany([
    {
      title: "SSC Test Series",
      category: "SSC",
      examTarget: "SSC CGL",
      totalPapers: 45,
      unitLabel: "Full Mock Tests",
      totalQuestions: 2250,
      durationMinutes: 60,
      difficulty: "Mixed Difficulty",
      isAvailable: true,
      isPublic: true,
      status: "published",
      accessType: "free",
    },
    {
      title: "Banking Test Series",
      category: "Banking",
      examTarget: "IBPS PO",
      totalPapers: 38,
      unitLabel: "Full Mock Tests",
      totalQuestions: 1900,
      durationMinutes: 90,
      difficulty: "Moderate",
      isAvailable: true,
      isPublic: true,
      status: "published",
      accessType: "free",
    },
    {
      title: "Railway Test Series",
      category: "Railway",
      examTarget: "RRB NTPC",
      totalPapers: 30,
      unitLabel: "Practice Papers",
      totalQuestions: 1500,
      durationMinutes: 60,
      difficulty: "Easy-Moderate",
      isAvailable: true,
      isPublic: true,
      status: "published",
      accessType: "free",
    },
    {
      title: "Police Test Series",
      category: "Police",
      examTarget: "SI / Constable",
      totalPapers: 25,
      unitLabel: "Practice Papers",
      totalQuestions: 1250,
      durationMinutes: 45,
      difficulty: "Moderate",
      isAvailable: true,
      isPublic: true,
      status: "published",
      accessType: "free",
    },
    {
      title: "Defence Test Series",
      category: "Defence",
      examTarget: "NDA / CDS",
      totalPapers: 20,
      unitLabel: "Full Mock Tests",
      totalQuestions: 1000,
      durationMinutes: 50,
      difficulty: "Moderate",
      isAvailable: true,
      isPublic: true,
      status: "published",
      accessType: "free",
    },
  ]);

  const sscSeries = seriesDocs.find((s) => s.category === "SSC")!;

  console.log("Seeding SSC CGL mock tests + questions...");
  const testDefs = [
    { title: "SSC CGL Mock Test – 01", difficulty: "Moderate", questions: TEST01_QUESTIONS },
    { title: "SSC CGL Mock Test – 02", difficulty: "Hard", questions: TEST02_QUESTIONS },
    { title: "SSC CGL Mock Test – 03", difficulty: "Easy", questions: TEST03_QUESTIONS },
  ];

  const createdTests = [];
  for (let i = 0; i < testDefs.length; i++) {
    const def = testDefs[i];
    const test = await Test.create({
      series: sscSeries._id,
      title: def.title,
      totalQuestions: def.questions.length,
      durationMinutes: 20,
      totalMarks: def.questions.length * 2,
      passingMarks: def.questions.length,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      maxAttempts: 1,
      difficulty: def.difficulty,
      status: "published",
      order: i,
    });
    await Question.insertMany(
      def.questions.map((q, idx) => ({
        test: test._id,
        subject: q.subject,
        text: q.text,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
        marks: 2,
        negativeMarks: 0.25,
        order: idx,
      }))
    );
    createdTests.push(test);
  }

  console.log("Seeding demo users for leaderboard...");
  const hashedPassword = await bcrypt.hash("Passw0rd", 10);
  const demoUsersDef = [
    { name: "Priya Singh", email: "priya.singh@example.com", mobile: "9811100001" },
    { name: "Rahul Sharma", email: "rahul.sharma@example.com", mobile: "9811100002" },
    { name: "Amit Kumar", email: "amit.kumar@example.com", mobile: "9811100003" },
    { name: "Sneha Patel", email: "sneha.patel@example.com", mobile: "9811100004" },
    { name: "Vikram Reddy", email: "vikram.reddy@example.com", mobile: "9811100005" },
  ];

  await User.deleteMany({ email: { $in: demoUsersDef.map((u) => u.email) } });
  const demoUsers = await User.insertMany(
    demoUsersDef.map((u) => ({ ...u, password: hashedPassword }))
  );

  const test01 = createdTests[0];
  const leaderboardScores = [89, 92, 87, 85, 83];
  for (let i = 0; i < demoUsers.length; i++) {
    const scorePercent = leaderboardScores[i];
    const score = Math.round((scorePercent / 100) * test01.totalMarks * 100) / 100;
    const correctCount = Math.round((scorePercent / 100) * test01.totalQuestions);
    await TestAttempt.create({
      user: demoUsers[i]._id,
      test: test01._id,
      title: test01.title,
      category: "SSC",
      totalQuestions: test01.totalQuestions,
      questionsCompleted: test01.totalQuestions,
      answers: [],
      status: "completed",
      startedAt: new Date(Date.now() - 20 * 60 * 1000),
      submittedAt: new Date(),
      timeTakenSeconds: 18 * 60,
      score,
      scorePercent,
      correctCount,
      wrongCount: test01.totalQuestions - correctCount,
      skippedCount: 0,
      accuracy: scorePercent,
      subjectBreakdown: [],
    });
  }

  console.log("Seed complete.");
  console.log(`SSC test IDs: ${createdTests.map((t) => t._id).join(", ")}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
