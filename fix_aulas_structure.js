const fs = require('fs');
const path = 'src/components/dashboard/SuperAdminView.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Modificar el estado y la lógica de creación de aulas
const newAulaLogic = `  const [isExistingAula, setIsExistingAula] = useState(false);
  
  const handleCreateAula = async () => {
    if (!newAula.nombre || !newAula.seccion) return;
    
    // Generamos un ID único combinando Nombre + Sección + InstId para evitar sobrescritura
    const uniqueId = \`\${newAula.nombre.replace(/\s+/g, '_')}_\${newAula.seccion}_\${selectedConfig.instId}\`.toLowerCase();
    
    try {
      await setDoc(doc(db, "aulas", uniqueId), {
        nombre: newAula.nombre,
        seccion: newAula.seccion.toUpperCase(),
        InstitutoId: selectedConfig.instId,
        createdAt: serverTimestamp(),
        active: true
      });
      setNewAula({ nombre: '', seccion: '' });
      setIsAddingAula(false);
      alert("✅ SECCIÓN CREADA CORRECTAMENTE");
    } catch (e) { console.error(e); }
  };`;

content = content.replace(/const handleCreateAula = async \(\) => \{[\s\S]*?\};/g, newAulaLogic);

// 2. Modificar el Modal de Creación para incluir el Switch de "Aula Existente"
const aulaModalUI = `                <div className="space-y-4 py-4">
                  <div className="flex bg-slate-900 p-1 rounded-xl mb-4">
                    <button 
                      onClick={() => setIsExistingAula(false)}
                      className={\`flex-1 py-2 text-[9px] font-black uppercase rounded-lg \${!isExistingAula ? 'bg-orange-500 text-white' : 'text-slate-500'}\`}
                    >Aula Nueva</button>
                    <button 
                      onClick={() => setIsExistingAula(true)}
                      className={\`flex-1 py-2 text-[9px] font-black uppercase rounded-lg \${isExistingAula ? 'bg-blue-600 text-white' : 'text-slate-500'}\`}
                    >Añadir Sección</button>
                  </div>

                  {isExistingAula ? (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Seleccionar Aula Existente</label>
                      <select 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white"
                        onChange={(e) => setNewAula({...newAula, nombre: e.target.value})}
                      >
                        <option value="">Seleccione...</option>
                        {[...new Set(aulas.map(a => a.nombre))].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre del Grado / Aula</label>
                      <input 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white"
                        placeholder="Ej: 6to Grado"
                        value={newAula.nombre}
                        onChange={(e) => setNewAula({...newAula, nombre: e.target.value})}
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Sección Nueva</label>
                    <input 
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white"
                      placeholder="Ej: B"
                      maxLength={1}
                      value={newAula.seccion}
                      onChange={(e) => setNewAula({...newAula, seccion: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>`;

content = content.replace(/\{isAddingAula && \([\s\S]*?<div className="space-y-4 py-4">[\s\S]*?<\/div>/, \`{isAddingAula && ( \n \${aulaModalUI}\`);

// 3. Corregir el Mapa de Aulas para agrupar por nombre y mostrar secciones
const groupedAulasUI = `            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...new Set(aulas.filter(a => a.InstitutoId === selectedConfig.instId).map(a => a.nombre))].map(aulaNombre => {
                const secciones = aulas.filter(a => a.nombre === aulaNombre && a.InstitutoId === selectedConfig.instId);
                return (
                  <div key={aulaNombre} className="bg-slate-900/50 border border-slate-800 p-4 rounded-[2rem]">
                    <h4 className="text-white font-black text-[12px] uppercase mb-3 text-center border-b border-slate-800 pb-2">{aulaNombre}</h4>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {secciones.map(sec => (
                        <button
                          key={sec.id}
                          onClick={() => {
                            setSelectedConfig({...selectedConfig, aulaId: sec.id, seccion: sec.seccion});
                            // Aquí puedes añadir la lógica para entrar a la sección
                          }}
                          className={\`w-10 h-10 rounded-full font-black text-[14px] flex items-center justify-center transition-all \${selectedConfig.aulaId === sec.id ? 'bg-orange-500 text-white scale-110 shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}\`}
                        >
                          {sec.seccion}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>`;

content = content.replace(/<div className="grid grid-cols-2 md:grid-cols-4 gap-4">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, groupedAulasUI + '\n            </div>\n          </div>');

fs.writeFileSync(path, content);
