import { X } from 'lucide-react';

// 1. Add maxWidth as a prop, and give it a default value of "max-w-md"
const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            {/* 2. Inject the dynamic ${maxWidth} variable here instead of a hardcoded class */}
            <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full ${maxWidth} mx-4 transform transition-all`}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors outline-none">
                        <X size={24} />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-6">
                    {children}
                </div>
                
            </div>
        </div>
    );
};

export default Modal;