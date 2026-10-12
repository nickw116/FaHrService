const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.candidate.count().then(n=>{console.log("CANDIDATE_COUNT="+n);process.exit(0)});
