# =============================================================================
# MONGODB DATABASE MODULE
# =============================================================================
# Handles all interactions with MongoDB for storing applicant profiles
# and assessment history.
# =============================================================================

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ServerSelectionTimeoutError
from datetime import datetime
import os

# MongoDB connection string (local)
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = 'loan_default_db'

# Collections
APPLICANTS_COLLECTION = 'applicants'
ASSESSMENTS_COLLECTION = 'assessments'


class DatabaseManager:
    """
    Manages MongoDB connection and CRUD operations for applicants and assessments.
    """

    def __init__(self, uri=MONGO_URI, db_name=DB_NAME):
        """Initialize MongoDB connection."""
        try:
            self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Test connection
            self.client.admin.command('ping')
            self.db = self.client[db_name]
            print(f"[DB] ✓ Connected to MongoDB: {db_name}")
            self._create_indexes()
        except ServerSelectionTimeoutError:
            print(f"[DB] ✗ Failed to connect to MongoDB at {uri}")
            print("     Make sure MongoDB is running: brew services start mongodb-community")
            self.client = None
            self.db = None

    def is_connected(self):
        """Check if database is connected."""
        return self.db is not None

    def _create_indexes(self):
        """Create indexes for efficient querying."""
        if not self.is_connected():
            return

        # Applicants: index by email for fast lookup
        self.db[APPLICANTS_COLLECTION].create_index([('email', ASCENDING)], unique=True)

        # Assessments: index by applicant_id and timestamp for quick history retrieval
        self.db[ASSESSMENTS_COLLECTION].create_index([('applicant_id', ASCENDING)])
        self.db[ASSESSMENTS_COLLECTION].create_index([('timestamp', DESCENDING)])
        self.db[ASSESSMENTS_COLLECTION].create_index([('risk_level', ASCENDING)])

        print("[DB] ✓ Indexes created")

    # ─────────────────────────────────────────────────────────────────────────
    # APPLICANT OPERATIONS
    # ─────────────────────────────────────────────────────────────────────────

    def get_or_create_applicant(self, email, name=None):
        """
        Get an applicant by email, or create if doesn't exist.

        Args:
            email (str): Applicant email (unique identifier)
            name (str, optional): Applicant full name

        Returns:
            dict: Applicant document with '_id' and other fields
        """
        if not self.is_connected():
            return None

        applicants = self.db[APPLICANTS_COLLECTION]

        # Try to find existing applicant
        applicant = applicants.find_one({'email': email})

        if applicant:
            # Update name if provided and different
            if name and applicant.get('name') != name:
                applicants.update_one({'_id': applicant['_id']}, {'$set': {'name': name}})
                applicant['name'] = name
            return applicant

        # Create new applicant
        applicant_doc = {
            'email': email,
            'name': name or 'Unknown',
            'created_at': datetime.utcnow(),
            'assessment_count': 0
        }
        result = applicants.insert_one(applicant_doc)
        applicant_doc['_id'] = result.inserted_id

        print(f"[DB] ✓ New applicant created: {email}")
        return applicant_doc

    def get_applicant(self, email):
        """Get applicant by email."""
        if not self.is_connected():
            return None
        return self.db[APPLICANTS_COLLECTION].find_one({'email': email})

    # ─────────────────────────────────────────────────────────────────────────
    # ASSESSMENT OPERATIONS
    # ─────────────────────────────────────────────────────────────────────────

    def save_assessment(self, applicant_email, form_data, prediction_result):
        """
        Save a complete assessment (form input + AI prediction) to the database.

        Args:
            applicant_email (str): Applicant's email
            form_data (dict): The raw form input (all 11 features + name)
            prediction_result (dict): The AI prediction output from /predict

        Returns:
            dict: The saved assessment document with '_id'
        """
        if not self.is_connected():
            return None

        # Get or create applicant
        applicant = self.get_or_create_applicant(
            applicant_email,
            form_data.get('applicant_name')
        )

        # Build assessment document
        assessment_doc = {
            'applicant_id': applicant['_id'],
            'applicant_email': applicant_email,
            'applicant_name': applicant.get('name', 'Unknown'),
            'timestamp': datetime.utcnow(),

            # Form inputs
            'form_data': {
                'applicant_name': form_data.get('applicant_name'),
                'annual_income': form_data.get('annual_income'),
                'employment_length': form_data.get('employment_length'),
                'home_ownership': form_data.get('home_ownership'),
                'is_new_customer': form_data.get('is_new_customer', False),
                'loan_amount': form_data.get('loan_amount'),
                'dti_ratio': form_data.get('dti_ratio'),
                'loan_purpose': form_data.get('loan_purpose'),
                'credit_score': form_data.get('credit_score'),
                'num_delinquencies': form_data.get('num_delinquencies'),
                'credit_history_years': form_data.get('credit_history_years'),
                'num_open_accounts': form_data.get('num_open_accounts'),
                'num_inquiries': form_data.get('num_inquiries'),
            },

            # AI Prediction
            'prediction': {
                'default_probability': prediction_result.get('default_probability'),
                'safe_probability': prediction_result.get('safe_probability'),
                'risk_level': prediction_result.get('risk_level'),
                'decision': prediction_result.get('decision'),
                'confidence': prediction_result.get('confidence'),
            },

            # Metadata for analytics
            'risk_level': prediction_result.get('risk_level'),
            'decision': prediction_result.get('decision'),
        }

        # Insert assessment
        result = self.db[ASSESSMENTS_COLLECTION].insert_one(assessment_doc)
        assessment_doc['_id'] = result.inserted_id

        # Update applicant's assessment count
        self.db[APPLICANTS_COLLECTION].update_one(
            {'_id': applicant['_id']},
            {'$inc': {'assessment_count': 1}}
        )

        print(f"[DB] ✓ Assessment saved for {applicant_email}")
        return assessment_doc

    def get_assessment_history(self, applicant_email, limit=10):
        """
        Get assessment history for an applicant (most recent first).

        Args:
            applicant_email (str): Applicant email
            limit (int): Max number of assessments to return

        Returns:
            list: List of assessment documents, sorted by timestamp (newest first)
        """
        if not self.is_connected():
            return []

        assessments = list(
            self.db[ASSESSMENTS_COLLECTION].find(
                {'applicant_email': applicant_email}
            ).sort('timestamp', DESCENDING).limit(limit)
        )

        # Convert ObjectId to string for JSON serialization
        for a in assessments:
            a['_id'] = str(a['_id'])
            a['applicant_id'] = str(a['applicant_id'])
            a['timestamp'] = a['timestamp'].isoformat()

        return assessments

    def get_statistics(self):
        """
        Get overall database statistics for dashboard/analytics.

        Returns:
            dict: Stats including total applicants, assessments, risk distribution
        """
        if not self.is_connected():
            return {}

        total_applicants = self.db[APPLICANTS_COLLECTION].count_documents({})
        total_assessments = self.db[ASSESSMENTS_COLLECTION].count_documents({})

        # Risk level distribution
        risk_dist = list(self.db[ASSESSMENTS_COLLECTION].aggregate([
            {'$group': {
                '_id': '$risk_level',
                'count': {'$sum': 1}
            }}
        ]))

        # Decision distribution
        decision_dist = list(self.db[ASSESSMENTS_COLLECTION].aggregate([
            {'$group': {
                '_id': '$decision',
                'count': {'$sum': 1}
            }}
        ]))

        return {
            'total_applicants': total_applicants,
            'total_assessments': total_assessments,
            'risk_distribution': {item['_id']: item['count'] for item in risk_dist},
            'decision_distribution': {item['_id']: item['count'] for item in decision_dist},
        }


# Global database instance
db_manager = DatabaseManager()
