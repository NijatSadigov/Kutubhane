import { useState } from 'react';
import api from '../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, School, Calendar, Users, GraduationCap } from 'lucide-react';

const Register = () => {
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        branch_id: '',
        grade: '',
        class_group: '',
        birth_date: ''
    });
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // 👇 FIX: Construct payload manually to match Go Backend JSON tags
            const payload = { 
                name: formData.name,
                email: formData.email,
                password: formData.password,
                
                // 1. ADD MISSING ROLE
                role: 'student', 

                // 2. Format Numbers
                branch_id: parseInt(formData.branch_id),
                grade: parseInt(formData.grade),
                
                // 3. Fix Key Names (snake_case -> camelCase) & Date Format
                classGroup: formData.class_group, 
                birthDate: new Date(formData.birth_date).toISOString()
            };
            
            await api.post('/register', payload);
            alert("Registration Successful! Please login.");
            navigate('/login');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.response?.data?.error || "Registration failed");
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 py-10">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <div className="text-center mb-6">
                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="text-blue-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Student Registration</h2>
                    <p className="text-gray-500">Create your library account</p>
                </div>

                {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* --- LOGIN INFO --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input name="name" type="text" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Ali Yilmaz" onChange={handleChange} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input name="email" type="email" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="student@school.com" onChange={handleChange} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input name="password" type="password" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="••••••••" onChange={handleChange} />
                    </div>

                    {/* --- STUDENT INFO --- */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <GraduationCap size={14} className="text-gray-400"/> Grade
                            </label>
                            <input name="grade" type="number" required min="1" max="12"
                                className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="1-12" onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <Users size={14} className="text-gray-400"/> Group
                            </label>
                            <input name="class_group" type="text" required 
                                className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="A, B, C..." onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Calendar size={14} className="text-gray-400"/> Date of Birth
                        </label>
                        <input name="birth_date" type="date" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={handleChange} />
                    </div>

                    {/* --- SCHOOL INFO --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            Branch ID 
                            <span className="text-xs text-gray-400 font-normal">(Ask your librarian)</span>
                        </label>
                        <div className="relative">
                            <School className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input name="branch_id" type="number" required 
                                className="w-full border border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. 1" onChange={handleChange} />
                        </div>
                    </div>

                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-4">
                        Create Account
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 font-bold hover:underline">
                        Login here
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;