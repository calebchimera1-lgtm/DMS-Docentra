-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "department_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "openings" INTEGER NOT NULL DEFAULT 1,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'OPEN',
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resume_url" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_posting_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "hired_employee_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "interviewer_id" TEXT,
    "stage" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "feedback" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_postings_company_id_deleted_at_status_idx" ON "job_postings"("company_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "candidates_company_id_deleted_at_idx" ON "candidates"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "candidates_company_id_email_idx" ON "candidates"("company_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "applications_hired_employee_id_key" ON "applications"("hired_employee_id");

-- CreateIndex
CREATE INDEX "applications_company_id_deleted_at_status_idx" ON "applications"("company_id", "deleted_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_posting_id_candidate_id_key" ON "applications"("job_posting_id", "candidate_id");

-- CreateIndex
CREATE INDEX "interviews_company_id_application_id_idx" ON "interviews"("company_id", "application_id");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_hired_employee_id_fkey" FOREIGN KEY ("hired_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
