
import React from 'react';
import Button from './Button';

interface CardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    buttonText: string;
}

const Card: React.FC<CardProps> = ({ title, description, icon, onClick, buttonText }) => {
    return (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 flex flex-col items-center text-center transform hover:-translate-y-2 transition-transform duration-300 shadow-lg hover:shadow-brand-primary/20">
            <div className="bg-brand-primary/10 text-brand-primary rounded-full p-4 mb-6">
                {icon}
            </div>
            <h3 className="text-2xl font-bold mb-3 text-light-text">{title}</h3>
            <p className="text-medium-text mb-8 flex-grow">{description}</p>
            <Button onClick={onClick} className="w-full mt-auto">{buttonText}</Button>
        </div>
    );
};

export default Card;
