from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Conversation
from ..schemas import ConversationDetail, ConversationOut, ConversationRename

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def get_conversation_or_404(db: Session, conversation_id: int) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conversation


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db)):
    query = select(Conversation).order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    return db.scalars(query).all()


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(db: Session = Depends(get_db)):
    conversation = Conversation()
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    return get_conversation_or_404(db, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationOut)
def rename_conversation(conversation_id: int, data: ConversationRename, db: Session = Depends(get_db)):
    conversation = get_conversation_or_404(db, conversation_id)
    conversation.title = data.title
    db.commit()
    return conversation


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    db.delete(get_conversation_or_404(db, conversation_id))
    db.commit()
