import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Navbar from "@/components/ui/Navbar";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { 
      id: 1, 
      text: "Hello! I'm AcademiQa's AI assistant. I can help you with task submission, expert matching, or answer any questions about our platform.", 
      sender: "bot" as const 
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Data arrays
  const stats = [
    { number: "15K+", label: "Academic Tasks Completed" },
    { number: "2K+", label: "PhD-Qualified Experts" },
    { number: "99.8%", label: "Client Satisfaction Rate" },
    { number: "4.9/5", label: "Average Expert Rating" },
  ];

  const services = [
    { 
      icon: "ri-graduation-cap-line", 
      title: "Thesis & Dissertation", 
      desc: "Research Proposal, Masters and PhD Research Thesis",
      color: "from-blue-500 to-cyan-500"
    },
    { 
      icon: "ri-code-s-slash-line", 
      title: "Programming & Tech", 
      desc: "Python, Java, ML projects, Data Structures, R Studio, SQL, Algorithm Design",
      color: "from-purple-500 to-pink-500"
    },
    { 
      icon: "ri-calculator-line", 
      title: "Mathematics & Stats", 
      desc: "Calculus, Algebra, Data Science, Statistical Analysis",
      color: "from-emerald-500 to-teal-500"
    },
    { 
      icon: "ri-microscope-line", 
      title: "Science & Engineering", 
      desc: "Nursing, Healthcare, Lab Reports, Research Papers",
      color: "from-orange-500 to-red-500"
    },
    { 
      icon: "ri-bar-chart-box-line", 
      title: "Business & Economics", 
      desc: "Accounting, Finance, Marketing, Business Plans, Investment Options, Product Market Research",
      color: "from-indigo-500 to-purple-500"
    },
    { 
      icon: "ri-article-line", 
      title: "Writing & Editing", 
      desc: "Document Formatting, Plagiarism and AI Check, Referencing, Editing",
      color: "from-green-500 to-emerald-500"
    },
  ];

  const features = [
    {
      icon: "ri-shield-keyhole-line",
      title: "Academic Integrity",
      description: "Plagiarism-free work with proper citations and references in all major formats",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: "ri-team-line",
      title: "Expert Verification",
      description: "All experts are PhD-verified with proven academic credentials and expertise",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: "ri-lock-line",
      title: "Secure & Confidential",
      description: "Enterprise-grade encryption and strict confidentiality agreements",
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      icon: "ri-24-hours-line",
      title: "24/7 Support",
      description: "Round-the-clock customer support and expert availability",
      gradient: "from-orange-500 to-red-500"
    }
  ];

  const testimonials = [
    { 
      name: "Dr. Sarah Chen", 
      role: "Computer Science PhD", 
      text: "AcademiQa helped me complete my dissertation research with expert guidance in machine learning. The platform's collaboration tools are exceptional.", 
      img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop&crop=face&auto=format"
    },
    { 
      name: "Prof. Michael Rodriguez", 
      role: "Mathematics Department", 
      text: "As an expert, I appreciate the serious academic environment. The students are motivated and the platform facilitates meaningful scholarly collaboration.", 
      img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face&auto=format"
    },
    { 
      name: "Emma Thompson", 
      role: "MBA Candidate", 
      text: "The business case study assistance was phenomenal. My expert provided insights that significantly improved my analysis and presentation.", 
      img: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&h=200&fit=crop&crop=face&auto=format"
    },
    { 
      name: "James Wilson", 
      role: "Engineering Student", 
      text: "Complex engineering calculations explained clearly by industry experts. The revision process ensured I understood every concept thoroughly.", 
      img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face&auto=format"
    },
  ];

  const faqs = [
    { 
      question: "How do you ensure the quality of work?", 
      answer: "All experts undergo rigorous verification of their academic credentials. We maintain a 4.9/5 average rating system and provide unlimited revisions until you're completely satisfied." 
    },
    { 
      question: "What subjects and academic levels do you support?", 
      answer: "We cover all academic levels from undergraduate to PhD across 50+ disciplines including STEM, humanities, business, law, medicine, and social sciences." 
    },
    { 
      question: "How does the revision process work?", 
      answer: "You can request unlimited revisions within the agreed timeframe. Our experts work closely with you to ensure every requirement is met to your satisfaction." 
    },
    { 
      question: "Is my personal information secure?", 
      answer: "Yes, we use enterprise-grade encryption and strict confidentiality protocols. Your data is never shared with third parties without explicit consent." 
    },
    { 
      question: "What qualifications do your experts have?", 
      answer: "Our expert network includes PhD holders, professors, industry professionals, and top graduate students from renowned universities worldwide." 
    },
  ];

  const processSteps = [
    { 
      step: "1", 
      title: "Submit Task", 
      desc: "Upload requirements and detailed instructions", 
      icon: "ri-upload-cloud-2-line",
      color: "from-blue-500 to-cyan-500"
    },
    { 
      step: "2", 
      title: "Expert Match", 
      desc: "Get matched with qualified experts", 
      icon: "ri-user-search-line",
      color: "from-purple-500 to-pink-500"
    },
    { 
      step: "3", 
      title: "Collaborate", 
      desc: "Real-time communication and tracking", 
      icon: "ri-chat-3-line",
      color: "from-emerald-500 to-teal-500"
    },
    { 
      step: "4", 
      title: "Review", 
      desc: "Unlimited revisions until satisfied", 
      icon: "ri-verified-badge-line",
      color: "from-orange-500 to-red-500"
    },
  ];

  // Handler functions
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setContactSubmitting(true);
    setTimeout(() => {
      setContactSuccess(true); 
      setName(""); 
      setEmail(""); 
      setMessage("");
      setContactSubmitting(false);
      setTimeout(() => setContactSuccess(false), 5000);
    }, 1000);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubmitting(true);
    setTimeout(() => {
      setNewsletterSuccess(true); 
      setNewsletterEmail("");
      setNewsletterSubmitting(false);
      setTimeout(() => setNewsletterSuccess(false), 5000);
    }, 1000);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = { id: Date.now(), text: chatInput, sender: "user" as const };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");

    setTimeout(() => {
      const responses = [
        "Our expert matching system connects you with PhD-qualified professionals in your field within minutes.",
        "You can upload multiple file types (PDF, DOCX, images) and track revisions in real-time.",
        "All payments are secured through escrow, and you get unlimited revisions until you're satisfied.",
        "Need help signing up? I can guide you through the process step by step!",
        "Our experts specialize in various fields including STEM, humanities, business, and programming.",
        "You can communicate directly with your expert through our secure messaging system."
      ];
      const botMsg = { 
        id: Date.now() + 1, 
        text: responses[Math.floor(Math.random() * responses.length)], 
        sender: "bot" as const 
      };
      setChatMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  useEffect(() => { if (showChat) inputRef.current?.focus(); }, [showChat]);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [chatMessages]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setShowChat(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  return (
    <div className="min-h-screen bg-white text-lg leading-relaxed antialiased">
      <Navbar />

      {/* Hero Section */}
      <section className="relative bg-cover bg-center min-h-screen flex items-center justify-center text-center text-white overflow-hidden pt-20"
        style={{ backgroundImage: "url('/img/hero-bg1.jpg')" }}>
        
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/80 to-blue-900/85"></div>
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 py-24 z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-12 border border-white/20">
            <i className="ri-verified-badge-fill text-blue-400 text-base"></i>
            <span className="text-base font-light tracking-wide">Trusted by 30,000+ Students Worldwide</span>
          </div>
          
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-light mb-4 text-white tracking-tight leading-tight">
              AcademiQa
            </h1>
            <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto mb-6"></div>
            <h2 className="text-2xl md:text-3xl font-light text-blue-100 mb-6 tracking-wide">
              Powered by Verified Experts
            </h2>
          </div>
          
          <p className="text-lg text-gray-200 mb-10 leading-relaxed max-w-2xl mx-auto font-light tracking-wide">
            Connect with qualified academics for comprehensive support across all disciplines and academic levels
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Button 
              onClick={() => navigate('/signup')} 
              className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border border-white/30 px-6 py-3 text-base font-normal rounded-lg hover:scale-105 transition-all duration-300"
            >
              <i className="ri-user-add-line mr-2"></i>
              Start as a Student Today
            </Button>
            </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-xl font-light text-white mb-1">
                  {stat.number}
                </div>
                <p className="text-blue-200 text-sm font-light tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <i className="ri-arrow-down-s-line text-xl text-white/50"></i>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-3">
            <span className="text-slate-600 font-light text-sm uppercase tracking-widest">
              Why Choose AcademiQa
            </span>
          </div>
          
          <h2 className="text-3xl font-light text-slate-900 mb-3 tracking-tight">
            World-Class Academic Support
          </h2>
          
          <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mb-8"></div>
          
          <p className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            We combine cutting-edge technology with academic excellence to deliver unparalleled support
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.gradient} rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:scale-105 transition-transform duration-300`}>
                  <i className={`${feature.icon} text-xl text-white`}></i>
                </div>
                <h3 className="text-lg font-normal text-slate-900 mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed font-light">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-3">
            <span className="text-slate-600 font-light text-sm uppercase tracking-widest">
              Our Services
            </span>
          </div>
          
          <h2 className="text-3xl font-light text-slate-900 mb-3 tracking-tight">
            Comprehensive Academic Support
          </h2>
          
          <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mb-8"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service, index) => (
              <div 
                key={index}
                className="group bg-slate-50 rounded-xl p-5 hover:shadow-md transition-all duration-300 border border-slate-200"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${service.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <i className={`${service.icon} text-xl text-white`}></i>
                </div>
                <h3 className="text-lg font-normal text-slate-900 mb-2">{service.title}</h3>
                <p className="text-slate-600 text-sm font-light">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-3">
            <span className="text-slate-600 font-light text-sm uppercase tracking-widest">
              Simple Process
            </span>
          </div>
          
          <h2 className="text-3xl font-light text-slate-900 mb-3 tracking-tight">
            How It Works
          </h2>
          
          <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mb-8"></div>
          
          <p className="text-lg text-slate-600 mb-10 max-w-xl mx-auto font-light">
            Get started in four simple steps and experience academic support like never before
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {processSteps.map((step, index) => (
              <div key={index} className="text-center">
                <div className={`w-12 h-12 bg-gradient-to-r ${step.color} rounded-lg flex items-center justify-center mx-auto mb-4 text-base font-normal text-white shadow-md`}>
                  {step.step}
                </div>
                
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <i className={`${step.icon} text-lg text-slate-700`}></i>
                  </div>
                  
                  <h3 className="text-base font-normal text-slate-900 mb-2 tracking-tight">{step.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-light">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 px-4 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-3">
            <span className="text-blue-200 font-light text-sm uppercase tracking-widest">
              Success Stories
            </span>
          </div>
          
          <h2 className="text-3xl font-light text-white mb-3 tracking-tight">
            Trusted by Academics
          </h2>
          
          <div className="w-12 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-400 mx-auto mb-8"></div>
          
          <p className="text-lg text-blue-100 mb-10 max-w-xl mx-auto font-light">
            Join thousands of students and professionals who have transformed their educational experience
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:border-white/30 transition-all duration-300 text-left"
              >
                <div className="flex items-start gap-4 mb-4">
                  <img 
                    src={testimonial.img} 
                    alt={testimonial.name}
                    className="w-10 h-10 rounded-lg object-cover border border-white/20"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="font-normal text-white text-base">{testimonial.name}</p>
                        <p className="text-blue-200 text-sm font-light">{testimonial.role}</p>
                      </div>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <i key={i} className="ri-star-fill text-yellow-400 text-base"></i>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-blue-100 text-sm leading-relaxed font-light">
                  "{testimonial.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="mb-3">
              <span className="text-slate-600 font-light text-sm uppercase tracking-widest">
                Support
              </span>
            </div>
            
            <h2 className="text-3xl font-light text-slate-900 mb-3 tracking-tight">
              Frequently Asked Questions
            </h2>
            
            <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mb-4"></div>
            
            <p className="text-lg text-slate-600 max-w-xl mx-auto font-light">
              Everything you need to know about our platform and services
            </p>
          </div>
          
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <button 
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors duration-200"
                >
                  <h4 className="text-base font-normal text-slate-900 pr-4 flex-1">
                    {faq.question}
                  </h4>
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 bg-blue-100 rounded-lg transition-colors">
                    <i className={`${openFaq === index ? 'ri-subtract-line' : 'ri-add-line'} text-base text-blue-600`}></i>
                  </div>
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4">
                    <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-3"></div>
                    <p className="text-slate-600 text-sm leading-relaxed font-light">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="mb-3">
              <span className="text-slate-600 font-light text-sm uppercase tracking-widest">
                Get In Touch
              </span>
            </div>
            
            <h2 className="text-3xl font-light text-slate-900 mb-3 tracking-tight">
              Ready to Start Your Academic Journey?
            </h2>
            
            <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mb-4"></div>
            
            <p className="text-lg text-slate-600 max-w-xl mx-auto font-light">
              Our team is here to help you achieve academic excellence. Reach out with any questions.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-xl font-normal text-slate-900 mb-6">Send Us a Message</h3>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <Input 
                  placeholder="Your Name" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  className="py-3 text-base border-slate-300 rounded-lg focus:border-blue-500"
                />
                <Input 
                  type="email" 
                  placeholder="Email Address" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  className="py-3 text-base border-slate-300 rounded-lg focus:border-blue-500"
                />
                <Textarea 
                  rows={4} 
                  placeholder="Tell us about your academic needs..." 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  required 
                  className="text-base border-slate-300 rounded-lg focus:border-blue-500 resize-none"
                />
                {contactSuccess && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                    <i className="ri-checkbox-circle-fill text-base"></i>
                    <span className="text-sm font-normal">Thank you! We'll get back to you within 2 hours.</span>
                  </div>
                )}
                <Button 
                  type="submit" 
                  disabled={contactSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-normal py-3 text-base rounded-lg transition-all"
                >
                  {contactSubmitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Sending Message...
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line mr-2"></i>
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
            
            <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-cyan-600 rounded-xl p-6 text-white">
              <h3 className="text-xl font-normal mb-6">Contact Information</h3>
              <div className="space-y-5">
                {[
                  { icon: "ri-mail-line", title: "Email", desc: "ad.academiqa@gmail.com", sub: "Typically replies within 30 minutes" },
                  { icon: "ri-chat-3-line", title: "Live Chat", desc: "Available 24/7", sub: "Instant connection with our team" },
                  { icon: "ri-phone-line", title: "Phone Support", desc: "+1 (555) 123-ACAD", sub: "24/7" },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className={`${item.icon} text-lg`}></i>
                    </div>
                    <div>
                      <p className="font-normal text-base">{item.title}</p>
                      <p className="text-blue-100 font-normal text-base">{item.desc}</p>
                      <p className="text-blue-200 text-sm mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-12 px-4 bg-gradient-to-r from-slate-900 via-purple-900 to-blue-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 mb-4 border border-white/20">
            <i className="ri-notification-3-line text-cyan-400 text-base"></i>
            <span className="text-sm font-normal">Stay Updated</span>
          </div>
          
          <h2 className="text-2xl font-light mb-3">
            Academic Insights & Updates
          </h2>
          
          <p className="text-base text-blue-100 mb-6 max-w-xl mx-auto font-light">
            Subscribe for expert tips, platform updates, and exclusive academic resources
          </p>
          
          <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <Input 
              type="email" 
              placeholder="Enter your email address" 
              value={newsletterEmail} 
              onChange={e => setNewsletterEmail(e.target.value)} 
              required 
              className="flex-1 bg-white/10 border-white/30 text-white placeholder:text-white/60 py-2.5 text-base rounded-lg backdrop-blur-sm"
            />
            <Button 
              type="submit" 
              disabled={newsletterSubmitting}
              className="bg-white text-slate-900 hover:bg-gray-100 font-normal px-4 py-2.5 text-base rounded-lg transition-all"
            >
              {newsletterSubmitting ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
          
          {newsletterSuccess && (
            <div className="mt-4 flex items-center justify-center gap-2 text-green-300">
              <i className="ri-checkbox-circle-fill text-base"></i>
              <span className="text-sm font-normal">Welcome to AcademiQa! Check your email for confirmation.</span>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-normal text-base">A</span>
                </div>
                <span className="text-xl font-normal text-white">AcademiQa</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-4 font-light">
                Connecting students with verified academic experts for unparalleled educational support and research collaboration.
              </p>
              <div className="flex gap-2">
                {['ri-twitter-fill', 'ri-linkedin-fill', 'ri-facebook-fill'].map((icon, index) => (
                  <button key={index} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors">
                    <i className={icon}></i>
                  </button>
                ))}
              </div>
            </div>
            
            {[
              {
                title: "Platform",
                links: ["Features", "How It Works", "Pricing", "Success Stories"]
              },
              {
                title: "Support",
                links: ["Help Center", "Contact Us", "FAQ", "Expert Application"]
              },
              {
                title: "Legal",
                links: ["Privacy Policy", "Terms of Service", "Academic Integrity"]
              }
            ].map((section, index) => (
              <div key={index}>
                <h4 className="text-white font-normal text-base mb-3">{section.title}</h4>
                <ul className="space-y-2">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors duration-200 font-light">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="pt-6 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm font-light">
              © 2025 AcademiQa. All rights reserved. 
              <a href="#" className="text-blue-400 hover:text-blue-300 ml-1 transition-colors">
                Designed for Academic Excellence by Mbogo27
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Chatbot */}
      <div className="fixed bottom-4 right-4 z-50">
        {showChat && (
          <div className="mb-3 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="ri-robot-2-line text-base"></i>
                </div>
                <div>
                  <div className="font-normal text-base">AcademiQa Assistant</div>
                  <div className="text-sm opacity-90 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    Online • Ready to help
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowChat(false)}
                className="hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <i className="ri-close-line text-base"></i>
              </button>
            </div>
            
            <div 
              ref={chatRef} 
              className="h-64 overflow-y-auto p-4 space-y-3 bg-slate-50 text-sm"
            >
              {chatMessages.map(message => (
                <div 
                  key={message.id} 
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[80%] px-3 py-2 rounded-lg leading-relaxed ${
                      message.sender === "user" 
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none" 
                        : "bg-white text-slate-900 border border-slate-200 rounded-bl-none shadow-sm"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            
            <form onSubmit={handleChatSubmit} className="p-3 border-t bg-white">
              <div className="flex gap-2">
                <Input 
                  ref={inputRef}
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  placeholder="Ask about our services..." 
                  className="flex-1 text-sm border-slate-300 rounded-lg focus:border-blue-500"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="h-9 w-9 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg"
                >
                  <i className="ri-send-plane-fill text-base"></i>
                </Button>
              </div>
            </form>
          </div>
        )}
        
        <button 
          onClick={() => setShowChat(t => !t)}
          className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center transition-all duration-300"
        >
          {showChat ? (
            <i className="ri-close-line"></i>
          ) : (
            <i className="ri-robot-2-line"></i>
          )}
        </button>
      </div>
    </div>
  );
}