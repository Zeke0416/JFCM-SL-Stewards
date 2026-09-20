import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Search, X, Tag } from 'lucide-react';

interface CategoryGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryGuideModal({ isOpen, onClose }: CategoryGuideModalProps) {
  const [guideSearchQuery, setGuideSearchQuery] = useState('');
  const [guideTab, setGuideTab] = useState<'INCOME' | 'EXPENSE'>('INCOME');

  const categoryGuideData = [
    // RECEIPTS (INCOME)
    { code: '5011', type: 'INCOME', name: 'Tithes - Local', desc: 'Any amount received from local sources in cash/check including members residing/working abroad.', example: 'Regular Sunday tithes.' },
    { code: '5015', type: 'INCOME', name: 'Tithes - Foreign', desc: 'Amount received from members in foreign countries.', example: 'Overseas remittances.' },
    { code: '5021', type: 'INCOME', name: 'Offerings - Local', desc: 'Any amount received from local sources in cash/check.', example: 'Loose cash offering.' },
    { code: '5022', type: 'INCOME', name: 'Offerings - Compassion Fund', desc: 'Financial assistance for emergencies, calamities, and benevolence.', example: 'Special collection for death/hospital.' },
    { code: '5023', type: 'INCOME', name: 'Offerings - Others', desc: 'Amount received for use of Fell. House, church services, and support for programs.', example: 'Non-tithe support.' },
    { code: '5025', type: 'INCOME', name: 'Offerings - Foreign', desc: 'Any amount received from foreign sources in cash/check.', example: 'Foreign partner offering.' },
    { code: '5031', type: 'INCOME', name: 'Pledges - Local', desc: 'Amount received as pledge to support a project/activity from local sources.', example: 'Share for Outdoor, Anniversary, Christmas.' },
    { code: '5032', type: 'INCOME', name: 'Pledges - Foreign', desc: 'Amount received as pledge to support a project/activity from foreign sources.', example: 'Foreign building pledge.' },
    { code: '7100', type: 'INCOME', name: 'Interest Income', desc: 'Interest on Bank Deposits (net of 20% Final Withholding Tax).', example: 'Bank interest.' },
    { code: '7300', type: 'INCOME', name: 'Miscellaneous Receipts', desc: 'Amount received which cannot be classified with standard receipts.', example: 'Fund raising, donated fixtures.' },
    
    // OTHER RECEIPTS
    { code: '2810', type: 'INCOME', name: 'Subsidy from Missions', desc: 'Regular subsidy received by a Church from Missions as support to operations.', example: 'Monthly mission support.' },
    { code: '2811', type: 'INCOME', name: 'Support from Missions', desc: 'Amount received by a Church from Missions as support/assistance to a project.', example: 'Project support.' },
    { code: '2017', type: 'INCOME', name: 'Accounts Payable - Others', desc: 'Church loan from Missions/Local Church or deposited Love Gift to a Member/Worker.', example: 'Passthrough love gift.' },
    { code: '2204', type: 'INCOME', name: 'Expanded Withholding Tax', desc: '5% Withholding Tax deducted from payment of rent for remittance to BIR.', example: 'EWT Deduction.' },
    { code: '2205', type: 'INCOME', name: 'Withholding Tax Payable', desc: 'Withholding Tax deducted/accumulated but not remitted as scheduled.', example: 'Tax payable.' },
    { code: '2206', type: 'INCOME', name: 'SSS Contribution Payable', desc: 'SSS Contribution deducted/accumulated but not remitted as scheduled.', example: 'SSS Payable.' },
    { code: '2210', type: 'INCOME', name: 'PhilHealth Contribution Payable', desc: 'PhilHealth Contribution deducted/accumulated but not remitted as scheduled.', example: 'PhilHealth Payable.' },
    { code: '2215', type: 'INCOME', name: 'Pag-Ibig Fund Payable', desc: 'Pag-Ibig Contribution deducted/accumulated but not remitted as scheduled.', example: 'Pag-Ibig Payable.' },
    { code: '2220', type: 'INCOME', name: 'SSS Loan Payable', desc: 'SSS Loan Payable deducted/accumulated but not remitted as scheduled.', example: 'SSS Loan Payable.' },
    { code: '1115', type: 'INCOME', name: 'Accounts Receivable - Others', desc: 'Amount as loan to an individual/church subject to collections.', example: 'Loan repayment.' },

    // OPERATING EXPENSES
    { code: '6010', type: 'EXPENSE', name: 'Salaries & Wages', desc: 'Remuneration given to full-time Church Pastor/Missionary and Worker (SEC registered).', example: 'Official monthly salary.' },
    { code: '6030', type: 'EXPENSE', name: 'Love Gifts - Personnel', desc: 'Amount given to full-time Pastor/Missionary/Worker in addition to regular remuneration.', example: 'Additional allowance.' },
    { code: '6401', type: 'EXPENSE', name: 'Love Gift - Missionary/Worker', desc: 'Remuneration given to Pastor/Missionary/Worker not classified as employee.', example: 'Love gift to Ptr. Daniel.' },
    { code: '6402', type: 'EXPENSE', name: 'Love Gifts - Others', desc: 'Assistance/help to NON-JF organization and NON-JF members.', example: 'Gift to external ministry.' },
    { code: '6403', type: 'EXPENSE', name: 'Love Gifts - Worship Place', desc: 'Amount paid for building/land for use as Worship Place WITHOUT EWT.', example: 'Rent without tax.' },
    { code: '6422', type: 'EXPENSE', name: 'Compassion Expense', desc: 'Financial assistance in case of emergencies, medical assistance, and benevolence.', example: 'Hospital aid, funeral flowers.' },
    { code: '6040', type: 'EXPENSE', name: 'SSS Premium (ER)', desc: 'Church share on SSS Premium of full-time employee.', example: 'SSS ER share.' },
    { code: '6050', type: 'EXPENSE', name: 'PhilHealth Premium (ER)', desc: 'Church share on PhilHealth Premium of full-time employee.', example: 'PhilHealth ER share.' },
    { code: '6060', type: 'EXPENSE', name: 'Pag-ibig Fund Premium (ER)', desc: 'Church share on Pag-ibig Premium of full-time employee.', example: 'Pag-ibig ER share.' },
    { code: '6070', type: 'EXPENSE', name: 'Medical Expense', desc: 'Medical treatment of full-time workers and cost of church medicine kit.', example: 'First aid supplies.' },
    { code: '6105', type: 'EXPENSE', name: 'Transportation Expenses', desc: 'Fares given to BS Leaders/Workers. Includes parking and toll fees.', example: 'Gas allowance, toll gate fees.' },
    { code: '6810', type: 'EXPENSE', name: 'Rental Expense', desc: 'Monthly rent for building/office supported by a contract (Subject to 5% EWT).', example: 'Monthly building lease.' },
    { code: '6811', type: 'EXPENSE', name: 'Input VAT Expense', desc: '12% Value Added Tax (VAT) added to the rental amount.', example: 'Rental VAT.' },
    { code: '6910', type: 'EXPENSE', name: 'Electricity', desc: 'Cost of monthly electric consumption.', example: 'Meralco Bill.' },
    { code: '6920', type: 'EXPENSE', name: 'Water', desc: 'Cost of monthly water consumption.', example: 'Maynilad Bill.' },
    { code: '6940', type: 'EXPENSE', name: 'Telephone, Postage & Telegraph', desc: 'Cost for telephone, postal and telegraphic charges.', example: 'LBC, JRS.' },
    { code: '6945', type: 'EXPENSE', name: 'Internet Expense', desc: 'Internet services including Zoom, Viber, and cellphone load for ministry.', example: 'PLDT Fiber, Zoom Pro.' },
    { code: '6930', type: 'EXPENSE', name: 'Janitorial & Utility Expense', desc: 'Supplies for cleaning/electrical, and amount paid for security/parking personnel.', example: 'Broom, soap, bulbs.' },
    { code: '6510', type: 'EXPENSE', name: 'Gas & Diesel', desc: 'Cost of gasoline and diesel.', example: 'Fuel.' },
    { code: '6210', type: 'EXPENSE', name: 'Food & Refreshment', desc: 'Cost of food during fellowships, meetings, and church activities.', example: 'Communion juice/bread, meeting snacks.' },
    { code: '6710', type: 'EXPENSE', name: 'Stationery & Office Supplies', desc: 'Cost of office supplies.', example: 'Copy paper, ballpens, printer ink.' },
    { code: '6715', type: 'EXPENSE', name: 'Computer Supplies', desc: 'Cost of computer supplies.', example: 'Ink, ribbons.' },
    { code: '6720', type: 'EXPENSE', name: 'Musical Supplies', desc: 'Musical supplies for musical equipment use.', example: 'Guitar string, battery.' },
    { code: '6270', type: 'EXPENSE', name: 'Program and Teaching Materials', desc: 'Materials used for teaching, Bibles, literature, signage, photocopies, uniforms.', example: 'Sunday school workbooks, usher uniforms.' },
    { code: '6730', type: 'EXPENSE', name: 'Kitchen Supplies', desc: 'Cost of household wares and kitchen utensils.', example: 'Plates, spoons, cooking gas.' },
    { code: '6955', type: 'EXPENSE', name: 'Notarial & Legal Fees', desc: 'Amount paid as notarial/legal expenses.', example: 'License to officiate marriage.' },
    { code: '6956', type: 'EXPENSE', name: 'Technical Support Fees', desc: 'Cost of technical support for equipment.', example: 'Location plan.' },
    { code: '6957', type: 'EXPENSE', name: 'Audit Fees', desc: 'Fees for auditor or accountant.', example: 'Audit fee.' },
    { code: '6515', type: 'EXPENSE', name: 'Vehicle Registration', desc: 'Cost for registration of church transport equipment.', example: 'TPL Insurance.' },
    { code: '6520', type: 'EXPENSE', name: 'Repair & Maint. - Transportation', desc: 'Cost of repair/maintenance of church equipment.', example: 'Change oil, tires.' },
    { code: '6691', type: 'EXPENSE', name: 'Repair & Maint. - Building', desc: 'Minor repair of building/fellowship house (less than 20k).', example: 'Paint, lights.' },
    { code: '6692', type: 'EXPENSE', name: 'Repair & Maint. - Office Eqpt', desc: 'Cost of repair of office equipment.', example: 'Printer repair.' },
    { code: '6693', type: 'EXPENSE', name: 'Repair & Maint. - Musical Eqpt', desc: 'Cost of repair of musical equipment.', example: 'Sound system repair.' },
    { code: '6694', type: 'EXPENSE', name: 'Repair & Maint. - Furniture', desc: 'Cost of repair of furniture.', example: 'Chair repair.' },
    { code: '6695', type: 'EXPENSE', name: 'Repair & Maint. - Electro Mech', desc: 'Cost of repair of electro-mechanical equipment.', example: 'Aircon repair.' },
    { code: '6971', type: 'EXPENSE', name: 'Insurance Expense - Bldg', desc: 'Premium paid for Bldg Insurance.', example: 'Fire insurance.' },
    { code: '6972', type: 'EXPENSE', name: 'Insurance Expense - Transport', desc: 'Premium paid for transport insurance.', example: 'Car insurance.' },
    { code: '6990', type: 'EXPENSE', name: 'Miscellaneous Expense', desc: 'Any expense that cannot be classified. Seldom used.', example: 'Clarify with Accounting first.' },
    { code: '7600', type: 'EXPENSE', name: 'Bank Charges', desc: 'Amount paid or charged by bank on transactions.', example: 'Transfer fees, checkbooks.' },

    // OTHER DISBURSEMENTS
    { code: '1125', type: 'EXPENSE', name: 'Advances', desc: 'Any cash given in advance that is subject to liquidation.', example: 'Advances (Include Name).' },
    { code: '1171', type: 'EXPENSE', name: 'Rental Deposit', desc: 'Deposit for renting an office and/or fellowship house.', example: 'Rental deposit.' },
    { code: '1800', type: 'EXPENSE', name: 'Missions Contribution', desc: 'Monthly contribution of the church to Missions Office.', example: '10% to Missions.' },
    { code: '1805', type: 'EXPENSE', name: 'Project Fund Contribution', desc: 'Contribution of the church to Missions Office projects.', example: 'Project contribution.' },
    { code: '1810', type: 'EXPENSE', name: 'Subsidy to Church', desc: 'Subsidy given by Local Church to Extension Church.', example: 'Monthly subsidy.' },
    { code: '1811', type: 'EXPENSE', name: 'Support to Church', desc: 'Amount given to a church to support its approved projects (one-time).', example: 'One-time support.' },
    
    // PROJECT EXPENSES
    { code: '1610', type: 'EXPENSE', name: 'Land', desc: 'Cost of land acquired including taxes/incidental costs.', example: 'Land purchase.' },
    { code: '1619', type: 'EXPENSE', name: 'Construction in Progress', desc: 'Cost of building construction before completion.', example: 'Permits, materials, labor.' },
    { code: '1620', type: 'EXPENSE', name: 'Building/Fellowship House', desc: 'Cost of building constructed/purchased.', example: 'Building cost.' },
    { code: '1626', type: 'EXPENSE', name: 'Leasehold Improvement', desc: 'Major repairs/improvements of rented building amounting to 20k and above.', example: 'Additional room, ceiling repair.' },
    { code: '1630', type: 'EXPENSE', name: 'Musical Instruments & Sound System', desc: 'Cost of various musical equipment acquired.', example: 'Guitar, drum set, microphones.' },
    { code: '1640', type: 'EXPENSE', name: 'Furnitures and Fixtures', desc: 'Cost of various furnitures and fixtures acquired.', example: 'Chairs, cabinets.' },
    { code: '1650', type: 'EXPENSE', name: 'Office Equipment', desc: 'Cost of office equipment acquired.', example: 'Computer, printer.' },
    { code: '1656', type: 'EXPENSE', name: 'Electro Mechanical Equipment', desc: 'Cost of electro mechanical equipment acquired.', example: 'Aircon, electric fan.' },
    { code: '1660', type: 'EXPENSE', name: 'Transportation Equipment', desc: 'Cost of vehicle owned and used by the church.', example: 'Car, motorcycle.' },
    { code: '1670', type: 'EXPENSE', name: 'Computer System & Software', desc: 'Cost of computer systems.', example: 'Quickbooks.' },
    
    // SEMINARS & SPECIAL EVENTS
    { code: '6251', type: 'EXPENSE', name: 'Doctrination', desc: 'Cost in conducting/attending Doctrination Seminar.', example: 'Toll, food, materials, love gifts.' },
    { code: '6252', type: 'EXPENSE', name: 'Equipping Seminar', desc: 'Cost in conducting/attending Equipping Seminar.', example: 'Toll, food, materials, love gifts.' },
    { code: '6253', type: 'EXPENSE', name: 'National Consultation', desc: 'Cost in attending yearly Pastor/Missionary National Consultation.', example: 'Toll, food, love gifts.' },
    { code: '6261', type: 'EXPENSE', name: 'Training Seminar (External)', desc: 'Cost in attending Training Seminar by other Non-JF Church.', example: 'Toll, food, materials, lodging.' },
    { code: '6262', type: 'EXPENSE', name: 'Pastor/Missionary Schooling', desc: 'Cost in the schooling of the Pastor/Missionary.', example: 'Tuition Fee, Toll, Materials.' },
    { code: '6301', type: 'EXPENSE', name: 'Feeding Program', desc: 'Total cost incurred by the activity.', example: 'Food, transport, materials.' },
    { code: '6302', type: 'EXPENSE', name: 'Project Activity (Fund Raising)', desc: 'Total cost incurred by the activity.', example: 'Materials, food.' },
    { code: '6351', type: 'EXPENSE', name: 'Outdoor Fellowship', desc: 'Total cost incurred for outdoor fellowship.', example: 'Venue, transport, food, materials.' },
    { code: '6352', type: 'EXPENSE', name: 'Foundation Day', desc: 'Total cost incurred by Foundation Day activity.', example: 'Venue, transport, food, materials.' },
    { code: '6353', type: 'EXPENSE', name: 'Youth Camp', desc: 'Total cost incurred by Youth Camp activity.', example: 'Venue, transport, food, materials.' },
    { code: '6354', type: 'EXPENSE', name: 'Christmas Celebration', desc: 'Total cost incurred by Christmas activity.', example: 'Venue, transport, food, materials.' },
    { code: '6355', type: 'EXPENSE', name: 'Sportsfest', desc: 'Total cost incurred by Sportsfest activity.', example: 'Venue, transport, food, materials.' },
    { code: '6356', type: 'EXPENSE', name: 'Retreat', desc: 'Total cost incurred by Retreat activity.', example: 'Venue, transport, food, materials.' },
    { code: '6357', type: 'EXPENSE', name: 'Anniversary Celebration', desc: 'Total cost incurred by Anniversary activity.', example: 'Venue, transport, food, materials.' },
    { code: '6358', type: 'EXPENSE', name: 'Water Baptism', desc: 'Total cost incurred by Water Baptism activity.', example: 'Venue, transport, food, materials.' },
    { code: '6359', type: 'EXPENSE', name: 'Other Special Events', desc: 'Total cost incurred by other activities not listed.', example: 'Venue, transport, food, materials.' },
  ];

  const filteredGuideData = useMemo(() => {
    return categoryGuideData.filter(item => 
      item.type === guideTab && 
      (item.name.toLowerCase().includes(guideSearchQuery.toLowerCase()) || 
       item.desc.toLowerCase().includes(guideSearchQuery.toLowerCase()) || 
       item.code.includes(guideSearchQuery))
    );
  }, [guideSearchQuery, guideTab]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-modal">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">ComBud Category Guide</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Reference directory from standard Chart of Accounts.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121212] space-y-4">
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl w-fit">
            <button onClick={() => setGuideTab('INCOME')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${guideTab === 'INCOME' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>Receipts (Income)</button>
            <button onClick={() => setGuideTab('EXPENSE')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${guideTab === 'EXPENSE' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>Operating Expenses</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by code or description..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#1A1A1A] text-xs font-medium text-slate-900 dark:text-white focus:border-brand" value={guideSearchQuery} onChange={(e) => setGuideSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-[#121212]">
          <div className="space-y-3">
            {filteredGuideData.length > 0 ? (
              filteredGuideData.map(item => (
                <div key={item.code} className="p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4">
                  <div className="sm:w-32 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono tracking-wide ${guideTab === 'INCOME' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'}`}>
                      <Tag className="h-3 w-3 mr-1.5" /> Account: {item.code}
                    </span>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    <div className="mt-2 text-[11px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <strong className="text-slate-700 dark:text-slate-300 uppercase tracking-wider">Remarks Example:</strong> {item.example}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-500 text-xs">No matching categories found in the guide.</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}