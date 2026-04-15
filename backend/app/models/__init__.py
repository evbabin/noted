"""Import all models so SQLAlchemy registers every mapper at app startup.

Models reference each other via string names in `relationship()`, so every
class must be imported before the first query is compiled. Centralizing it
here means callers only need `from app import models` (or any model import)
to guarantee full registration.
"""

from app.models.base import Base
from app.models.note import Note
from app.models.note_version import NoteVersion
from app.models.notebook import Notebook
from app.models.quiz import QuestionType, Quiz, QuizStatus
from app.models.quiz_attempt import QuizAttempt
from app.models.quiz_question import QuizQuestion
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import MemberRole, WorkspaceMember

__all__ = [
    "Base",
    "MemberRole",
    "Note",
    "NoteVersion",
    "Notebook",
    "QuestionType",
    "Quiz",
    "QuizAttempt",
    "QuizQuestion",
    "QuizStatus",
    "User",
    "Workspace",
    "WorkspaceMember",
]
